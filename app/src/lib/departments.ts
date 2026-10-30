/** Afdelingerne (hard-codet liste; `employees.department` er tekst). */
export const DEPARTMENTS = ["Marketing", "Økonomi", "Digital Transformation", "IT", "Hotel & Administration", "Topas Travel", "Disko Line Administration"];

/**
 * Afdelinger med enkel visning: de registrerer kun dagen (mødt/gået/frokost), fravær og ferie
 * til løn, saldo og ferie. Ingen timefordeling, opgavetyper eller viderefakturering.
 */
export const SIMPLE_DEPARTMENTS = ["Topas Travel"];

export const isSimpleDepartment = (department: string | null | undefined): boolean => SIMPLE_DEPARTMENTS.includes(department || "");
