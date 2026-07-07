// Schlick Fresnel approximation

// base: F0 reflectivity at normal incidence (0.04 for glass, 0.95 for mirror)
float fresnelSchlick(vec3 viewDir, vec3 normal, float base) {
  float cosTheta = max(0.0, dot(normalize(viewDir), normalize(normal)));
  return base + (1.0 - base) * pow(1.0 - cosTheta, 5.0);
}

// Configurable power for artistic control
float fresnelPow(vec3 viewDir, vec3 normal, float base, float power) {
  float cosTheta = max(0.0, dot(normalize(viewDir), normalize(normal)));
  return base + (1.0 - base) * pow(1.0 - cosTheta, power);
}

// Rim lighting intensity
float rimLight(vec3 viewDir, vec3 normal, float rimPower) {
  float NdotV = max(0.0, dot(normalize(normal), normalize(viewDir)));
  return pow(1.0 - NdotV, rimPower);
}
