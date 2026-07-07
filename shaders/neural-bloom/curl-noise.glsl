// 3D Curl noise — divergence-free vector field from simplex gradients

vec3 curlNoise(vec3 p) {
  float eps = 0.001;
  // Compute partial derivatives of three noise functions
  // Curl = (dFz/dy - dFy/dz, dFx/dz - dFz/dx, dFy/dx - dFx/dy)
  float n1, n2, a;

  // Offset each noise function by a constant to make them independent
  vec3 p1 = p + vec3( 31.416, 57.721, 19.283);
  vec3 p2 = p + vec3(-72.345, 15.693,  84.214);

  // dF1/dy, dF1/dz
  n1 = snoise(vec3(p.x,  p.y + eps, p.z));
  n2 = snoise(vec3(p.x,  p.y - eps, p.z));
  float dF1dy = (n1 - n2) / (2.0 * eps);

  n1 = snoise(vec3(p.x, p.y, p.z + eps));
  n2 = snoise(vec3(p.x, p.y, p.z - eps));
  float dF1dz = (n1 - n2) / (2.0 * eps);

  // dF2/dx, dF2/dz
  n1 = snoise(p1 + vec3(eps, 0.0, 0.0));
  n2 = snoise(p1 - vec3(eps, 0.0, 0.0));
  float dF2dx = (n1 - n2) / (2.0 * eps);

  n1 = snoise(p1 + vec3(0.0, 0.0, eps));
  n2 = snoise(p1 - vec3(0.0, 0.0, eps));
  float dF2dz = (n1 - n2) / (2.0 * eps);

  // dF3/dx, dF3/dy
  n1 = snoise(p2 + vec3(eps, 0.0, 0.0));
  n2 = snoise(p2 - vec3(eps, 0.0, 0.0));
  float dF3dx = (n1 - n2) / (2.0 * eps);

  n1 = snoise(p2 + vec3(0.0, eps, 0.0));
  n2 = snoise(p2 - vec3(0.0, eps, 0.0));
  float dF3dy = (n1 - n2) / (2.0 * eps);

  // Curl = (dF3/dy - dF2/dz, dF1/dz - dF3/dx, dF2/dx - dF1/dy)
  return vec3(
    dF3dy - dF2dz,
    dF1dz - dF3dx,
    dF2dx - dF1dy
  );
}

// Time-varying curl noise
vec3 curlNoiseAnimated(vec3 p, float t, float speed) {
  return curlNoise(p + vec3(0.0, 0.0, t * speed));
}
