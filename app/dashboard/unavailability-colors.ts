export const unavailableColors = [
  { backgroundColor: "#fce9e4", borderColor: "#e7a99a", textColor: "#8e2f1e" },
  { backgroundColor: "#e8f3ff", borderColor: "#9fc6eb", textColor: "#24527a" },
  { backgroundColor: "#eee9fb", borderColor: "#b8a7e2", textColor: "#58408c" },
  { backgroundColor: "#e5f6ee", borderColor: "#9ed4b7", textColor: "#246b45" },
  { backgroundColor: "#fff4d8", borderColor: "#e6c675", textColor: "#806018" },
];

export function unavailableColor(memberId: string, memberName: string) {
  let hash = 2166136261;
  for (const character of `${memberId}:${memberName}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return unavailableColors[(hash >>> 0) % unavailableColors.length];
}