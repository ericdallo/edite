// Node test environment lacks the object-URL helpers the store touches when it
// revokes media URLs (newProject/closeProject). Stub them so pure-logic tests
// can exercise those paths without a DOM.
const urlShim = URL as unknown as {
  createObjectURL?: (obj: unknown) => string;
  revokeObjectURL?: (url: string) => void;
};
urlShim.createObjectURL ??= () => 'blob:test';
urlShim.revokeObjectURL ??= () => undefined;
