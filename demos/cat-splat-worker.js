// Background worker for cat.html. It does the two jobs that are too slow for the page's main thread:
//
//   "decode": unzip and unpack a .spz file, then pack each Gaussian's numbers into texture-shaped arrays
//             that the GPU can read.
//   "sort":   order the Gaussians from farthest to nearest for the current camera.
//
// Running these here keeps the page (and the orbiting camera) smooth while the work happens.

// The constant of the first ("degree 0") spherical-harmonics term. 3D Gaussian splatting stores colors as
// spherical-harmonics coefficients; the degree-0 one is the plain color seen from every direction.
const SH_C0 = 0.28209479177387814;

let centersForSorting = null;   // x, y, z of every Gaussian in the most recently decoded file

self.onmessage = async event => {
  const message = event.data;
  if (message.type === 'decode') {
    try {
      const gaussians = await parseSpz(message.bytes);
      const packed = packIntoTextures(gaussians, message.textureWidth);
      centersForSorting = gaussians.positions;
      self.postMessage({ type: 'decoded', count: gaussians.count, ...packed },
        Object.values(packed).map(array => array.buffer));   // hand over the arrays without copying them
    } catch (error) {
      self.postMessage({ type: 'error', message: error.message });
    }
  } else if (message.type === 'sort' && centersForSorting) {
    const order = sortBackToFront(centersForSorting, message.modelView);
    self.postMessage({ type: 'sorted', order }, [order.buffer]);
  }
};

// ---------------------------------------------------------------------------------------------------------
// Reading a .spz file (Niantic's compressed Gaussian-splat format): a gzip stream holding a 16-byte header,
// then each property for ALL Gaussians in turn (all positions, then all opacities, then all colors, ...).
// Every Gaussian is described by:
//   position  where its center is (x, y, z)
//   scale     how far it spreads along its own three axes (like the radii of an ellipsoid)
//   rotation  how those axes are turned, as a quaternion (x, y, z, w)
//   opacity   how solid it is at its center, 0..1
//   color     r, g, b
// ---------------------------------------------------------------------------------------------------------
async function parseSpz(fileBytes) {
  const unzipped = new Response(new Blob([fileBytes]).stream().pipeThrough(new DecompressionStream('gzip')));
  const data = new Uint8Array(await unzipped.arrayBuffer());
  const header = new DataView(data.buffer);
  if (header.getUint32(0, true) !== 0x5053474e) throw new Error('This does not look like an SPZ file.');
  const version = header.getUint32(4, true);
  if (version < 2) throw new Error(`SPZ version ${version} is not supported.`);
  const count = header.getUint32(8, true);
  const fractionalBits = data[13];   // positions are fixed-point numbers with this many bits after the point
  let offset = 16;

  // Positions: 24-bit signed fixed-point integers.
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++, offset += 3) {
    let value = data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16);
    if (value & 0x800000) value -= 0x1000000;   // sign-extend 24 bits
    positions[i] = value / (1 << fractionalBits);
  }
  // Opacities: one byte each.
  const opacities = new Float32Array(count);
  for (let i = 0; i < count; i++) opacities[i] = data[offset++] / 255;
  // Colors: one byte per channel, a squeezed spherical-harmonics coefficient turned back into a 0..1 color.
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) colors[i] = 0.5 + SH_C0 * ((data[offset++] / 255 - 0.5) / 0.15);
  // Scales: one byte per axis on a logarithmic scale, so tiny and large Gaussians both keep precision.
  const scales = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) scales[i] = Math.exp(data[offset++] / 16 - 10);

  // Rotations (quaternions of length 1).
  const rotations = new Float32Array(count * 4);
  if (version >= 3) {
    // "Smallest three" packing in 32 bits: 2 bits say which component is largest; the other three are stored
    // as 10 bits each (sign + 9-bit size); the largest is rebuilt because the quaternion has length 1.
    for (let i = 0; i < count; i++, offset += 4) {
      let packed = (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
      const largestIndex = packed >>> 30;
      let sumOfSquares = 0;
      for (let component = 3; component >= 0; component--) {
        if (component === largestIndex) continue;
        const size = Math.SQRT1_2 * (packed & 511) / 511;
        const value = (packed >>> 9) & 1 ? -size : size;
        packed >>>= 10;
        rotations[i * 4 + component] = value;
        sumOfSquares += value * value;
      }
      rotations[i * 4 + largestIndex] = Math.sqrt(Math.max(0, 1 - sumOfSquares));
    }
  } else {
    // Older files store x, y, z in a byte each and w is rebuilt.
    for (let i = 0; i < count; i++, offset += 3) {
      const x = data[offset] / 127.5 - 1, y = data[offset + 1] / 127.5 - 1, z = data[offset + 2] / 127.5 - 1;
      rotations.set([x, y, z, Math.sqrt(Math.max(0, 1 - x * x - y * y - z * z))], i * 4);
    }
  }
  // The file may continue with view-dependent color (higher spherical-harmonics terms). This demo skips it.
  return { count, positions, scales, rotations, opacities, colors };
}

// ---------------------------------------------------------------------------------------------------------
// Packing for the GPU. The vertex shader looks a Gaussian up by its number, so its data goes into textures:
// texel i of each texture belongs to Gaussian i (rows of textureWidth texels, 4 numbers per texel).
//   centerAndOpacity: x, y, z, opacity
//   covarianceA:      Σxx, Σxy, Σxz, Σyy
//   covarianceB:      Σyz, Σzz, (unused), (unused)
//   color:            r, g, b, (unused)
// Σ is the Gaussian's 3x3 covariance matrix ("spread" in every direction): Σ = R · S² · Rᵀ, where R is the
// rotation matrix and S the diagonal matrix of scales. It is symmetric, so six numbers describe it fully.
// ---------------------------------------------------------------------------------------------------------
function packIntoTextures(gaussians, textureWidth) {
  const { count, positions, scales, rotations, opacities, colors } = gaussians;
  const paddedLength = Math.ceil(count / textureWidth) * textureWidth * 4;
  const centerAndOpacity = new Float32Array(paddedLength);
  const covarianceA = new Float32Array(paddedLength);
  const covarianceB = new Float32Array(paddedLength);
  const color = new Float32Array(paddedLength);

  for (let i = 0; i < count; i++) {
    centerAndOpacity.set([positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], opacities[i]], i * 4);
    color.set([colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2], 1], i * 4);

    // Rotation matrix from the quaternion (x, y, z, w).
    const x = rotations[i * 4], y = rotations[i * 4 + 1], z = rotations[i * 4 + 2], w = rotations[i * 4 + 3];
    const r00 = 1 - 2 * (y * y + z * z), r01 = 2 * (x * y - w * z), r02 = 2 * (x * z + w * y);
    const r10 = 2 * (x * y + w * z), r11 = 1 - 2 * (x * x + z * z), r12 = 2 * (y * z - w * x);
    const r20 = 2 * (x * z - w * y), r21 = 2 * (y * z + w * x), r22 = 1 - 2 * (x * x + y * y);
    // Squared scales: the variances along the Gaussian's own axes.
    const sx = scales[i * 3] ** 2, sy = scales[i * 3 + 1] ** 2, sz = scales[i * 3 + 2] ** 2;
    // Σ = R · diag(sx, sy, sz) · Rᵀ, written out entry by entry.
    covarianceA.set([
      r00 * r00 * sx + r01 * r01 * sy + r02 * r02 * sz,   // Σxx
      r00 * r10 * sx + r01 * r11 * sy + r02 * r12 * sz,   // Σxy
      r00 * r20 * sx + r01 * r21 * sy + r02 * r22 * sz,   // Σxz
      r10 * r10 * sx + r11 * r11 * sy + r12 * r12 * sz,   // Σyy
    ], i * 4);
    covarianceB[i * 4] = r10 * r20 * sx + r11 * r21 * sy + r12 * r22 * sz;       // Σyz
    covarianceB[i * 4 + 1] = r20 * r20 * sx + r21 * r21 * sy + r22 * r22 * sz;   // Σzz
  }
  return { centerAndOpacity, covarianceA, covarianceB, color };
}

// ---------------------------------------------------------------------------------------------------------
// Sorting. Gaussians are see-through, and "over" blending only gives the right picture when farther ones are
// drawn first and nearer ones are blended on top. The depth test can't help with soft, semi-transparent
// shapes, so the order itself must be right, and it changes whenever the camera moves.
//
// A full comparison sort of ~a million numbers is slow, so this is a counting sort: depths are rounded into
// 65,536 buckets, the buckets are counted, and each Gaussian is dropped into its bucket's slot. Two passes.
// ---------------------------------------------------------------------------------------------------------
function sortBackToFront(centers, modelView) {
  const count = centers.length / 3;
  const m = modelView;   // column-major 4x4 matrix: object coordinates -> camera coordinates
  const depths = new Float32Array(count);
  let minDepth = Infinity, maxDepth = -Infinity;
  for (let i = 0; i < count; i++) {
    // Only the camera-space z is needed. The camera looks down -z, so more negative = farther away.
    const z = m[2] * centers[i * 3] + m[6] * centers[i * 3 + 1] + m[10] * centers[i * 3 + 2] + m[14];
    depths[i] = z;
    if (z < minDepth) minDepth = z;
    if (z > maxDepth) maxDepth = z;
  }
  const bucketCount = 65536;
  const scale = (bucketCount - 1) / Math.max(1e-9, maxDepth - minDepth);
  const buckets = new Uint32Array(count);
  const bucketSizes = new Uint32Array(bucketCount);
  for (let i = 0; i < count; i++) {
    buckets[i] = Math.floor((depths[i] - minDepth) * scale);   // bucket 0 = farthest
    bucketSizes[buckets[i]]++;
  }
  const bucketStarts = new Uint32Array(bucketCount);
  for (let b = 1; b < bucketCount; b++) bucketStarts[b] = bucketStarts[b - 1] + bucketSizes[b - 1];
  // Float32 because the page feeds this straight into a per-instance vertex attribute.
  const order = new Float32Array(count);
  for (let i = 0; i < count; i++) order[bucketStarts[buckets[i]]++] = i;
  return order;
}
