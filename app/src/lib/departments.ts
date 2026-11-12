/** Afdelingerne (hard-codet liste; `employees.department` er tekst). */
export const DEPARTMENTS = ["Marketing", "Økonomi", "Digital Transformation", "IT", "Hotel & Administration", "Topas Travel", "Disko Line Administration"];

/**
 * Afdelinger hvor nye medarbejdere som standard er uden opgavestyring (enkel visning): de registrerer kun
 * dagen (mødt/gået/frokost), fravær og ferie til løn, saldo og ferie. Ingen timefordeling eller viderefakturering.
 * Det er kun en startværdi: det gældende er fluebenet "Opgavestyring" pr. medarbejder (`employees.task_tracking`).
 */
export const SIMPLE_DEPARTMENTS = ["Topas Travel"];

export const isSimpleDepartment = (department: string | null | undefined): boolean => SIMPLE_DEPARTMENTS.includes(department || "");

/** Startværdien for "Opgavestyring" for en ny medarbejder i afdelingen. */
export const defaultTaskTracking = (department: string | null | undefined): boolean => !isSimpleDepartment(department);

/**
 * Har medarbejderen opgavestyring (skriver ned, hvad de har arbejdet med = Timefordeling)?
 * Uden opgavestyring vises den enkle visning. Mangler feltet, gælder afdelingens startværdi.
 */
export const hasTaskTracking = (emp: { task_tracking?: boolean | null; department?: string | null } | null | undefined): boolean =>
  emp?.task_tracking ?? defaultTaskTracking(emp?.department);

/**
 * Afdelinger med vagttelefon: i Min tid kan de skrive timer på vagttelefonen på en dag (også en dag uden arbejde,
 * fx en søndag). Timerne vises kun i en separat kolonne og tæller ikke med i Kontrol, saldo eller Flex.
 */
export const ONCALL_DEPARTMENTS = ["Topas Travel"];

export const hasOncall = (department: string | null | undefined): boolean => ONCALL_DEPARTMENTS.includes(department || "");
