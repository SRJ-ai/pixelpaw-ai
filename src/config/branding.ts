/**
 * Central branding + defaults. Kept in one place so the whole product can be
 * renamed / re-skinned (§2 "modular branding") without touching feature code.
 */
export const BRANDING = {
  appName: "PixelPaw AI",
  appId: "com.pixelpaw.ai",
  tagline: "Your tiny desktop companion",
  defaultPetName: "Pixel",
  defaultSpecies: "cat" as const,
  version: "0.2.0",
} as const;
