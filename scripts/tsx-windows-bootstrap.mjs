// tsx obtiene un identificador temporal mediante os.userInfo() en Windows.
// Algunos hosts restringidos no exponen esa API; un UID estable evita que el
// runner falle antes de cargar el seed o una sola prueba.
if (process.platform === "win32" && typeof process.geteuid !== "function") {
  Object.defineProperty(process, "geteuid", {
    configurable: true,
    value: () => 0,
  });
}
