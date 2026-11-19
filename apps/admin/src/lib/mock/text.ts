/** Qidiruv uchun: kichik harf, apostrof variantlari bir xil (o', oʻ, o`). */
export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ʻʼ‘’`]/g, "'")
    .trim();
}

/** Ism-familiya, Instagram yoki telefon (kamida 3 ta raqam) bo'yicha moslik. */
export function matchesPerson(
  person: { firstName: string; lastName: string; phone: string; instagramUsername?: string | null },
  rawSearch: string,
  extra = "",
): boolean {
  const needle = normalizeSearch(rawSearch);
  if (!needle) return true;

  const names = normalizeSearch(
    `${person.firstName} ${person.lastName} ${person.lastName} ${person.firstName} ${extra}`,
  );
  if (names.includes(needle)) return true;

  const username = needle.replace(/^@/, "");
  if (person.instagramUsername && username && person.instagramUsername.includes(username)) {
    return true;
  }

  const digits = needle.replace(/\D/g, "");
  return digits.length >= 3 && person.phone.replace(/\D/g, "").includes(digits);
}
