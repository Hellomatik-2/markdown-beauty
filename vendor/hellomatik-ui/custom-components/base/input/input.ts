// SHIM local del consumer (no es archivo del kit): search-input.tsx importa
// "./input" relativo, pero el Input vive en components-base. Re-export puro.
export * from "../../../components-base/base/input/input";
