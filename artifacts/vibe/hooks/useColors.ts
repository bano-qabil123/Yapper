import colors from "@/constants/colors";

/**
 * Always returns the dark palette — Vibe is a dark-first app.
 */
export function useColors() {
  return { ...colors.dark, radius: colors.radius };
}
