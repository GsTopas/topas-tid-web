/** Afdelingerne (hard-codet liste; `employees.department` er tekst). */
export const DEPARTMENTS = ["Marketing", "Økonomi", "Digital Transformation", "IT", "Hotel & Administration", "Topas Travel", "Disko Line Administration"];

/**
 * Afdelinger med enkel visning: de registrerer kun dagen (mødt/gået/frokost), fravær og ferie
 * til løn, saldo og ferie. Ingen timefordeling, opgavetyper eller viderefakturering.
 */
export const SIMPLE_DEPARTMENTS = ["Topas Travel"];

export const isSimpleDepartment = (department: string | null | undefined): boolean => SIMPLE_DEPARTMENTS.includes(department || "");

/**
 * Afdelinger med vagttelefon: i Min tid kan de skrive timer på vagttelefonen på en dag (også en dag uden arbejde,
 * fx en søndag). Timerne vises kun i en separat kolonne og tæller ikke med i Kontrol, saldo eller Flex.
 */
export const ONCALL_DEPARTMENTS = ["Topas Travel"];

export const hasOncall = (department: string | null | undefined): boolean => ONCALL_DEPARTMENTS.includes(department || "");
