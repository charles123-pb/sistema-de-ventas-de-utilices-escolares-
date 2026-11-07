// Listas referenciales; no representan requisitos oficiales de ningún colegio.
export const schoolLists = [
  {
    id: "inicial",
    title: "Inicial · 4 y 5 años",
    icon: "palette",
    detail: "Arte, recortes y primeras actividades",
    budget: "65.00",
    text: "2 cuadernos de dibujo A4\n1 caja de colores de 12\n1 caja de plastilina de 12 colores\n1 goma blanca de 90 g\n1 tijera escolar punta roma\n2 pliegos de papel crepé\n2 pliegos de cartulina de color\n1 set de témperas de 6 colores",
  },
  {
    id: "primaria-baja",
    title: "1.º y 2.º de primaria",
    icon: "journal-text",
    detail: "Escritura y primeros aprendizajes",
    budget: "80.00",
    text: "3 cuadernos triple renglón\n2 cuadernos cuadriculados A4\n4 lápices HB\n2 borradores blancos\n1 tajador con depósito\n1 regla de 30 cm\n1 caja de colores de 12\n1 pegamento en barra\n1 folder manila A4",
  },
  {
    id: "primaria-alta",
    title: "3.º a 6.º de primaria",
    icon: "backpack",
    detail: "Cuadernos y accesorios para cada curso",
    budget: "110.00",
    text: "4 cuadernos cuadriculados A4\n3 cuadernos rayados A4\n1 cuaderno de dibujo\n3 lapiceros azules\n1 lapicero rojo\n2 lápices HB\n1 caja de colores de 12\n1 regla de 30 cm\n1 goma blanca\n2 folders manila",
  },
  {
    id: "secundaria",
    title: "Secundaria",
    icon: "calculator",
    detail: "Apuntes, organización y matemáticas",
    budget: "150.00",
    text: "4 cuadernos cuadriculados A4\n4 cuadernos rayados A4\n3 lapiceros azules\n2 lapiceros negros\n1 lapicero rojo\n1 portaminas de 0.5 mm\n2 resaltadores\n1 regla de 30 cm\n1 calculadora básica\n1 cartuchera",
  },
  {
    id: "arte",
    title: "Taller de arte",
    icon: "brush",
    detail: "Una selección para crear y experimentar",
    budget: "75.00",
    text: "2 cuadernos de dibujo A4\n1 set de témperas de 6 colores\n1 set de acuarelas de 12 colores\n1 juego de pinceles de 3 piezas\n1 caja de colores de 12\n2 pliegos de cartulina de color\n2 pliegos de papel lustre",
  },
  {
    id: "oficina",
    title: "Oficina y estudio",
    icon: "briefcase",
    detail: "Documentos y escritorio organizados",
    budget: "120.00",
    text: "1 resma de papel bond A4 de 500 hojas\n6 lapiceros azules\n3 lapiceros negros\n2 resaltadores\n2 archivadores de lomo ancho\n5 folders manila A4\n10 micas transparentes A4\n1 grapadora\n1 caja de grapas 26/6\n1 caja de clips de 100\n1 cinta adhesiva transparente",
  },
];
// Elige una ilustración local a partir del nombre o categoría cuando no hay fotografía disponible.
export function illustrationFor(name: string, category = "") {
  const text = (name + " " + category).toLocaleLowerCase("es");
  if (/mochila|cartuchera/.test(text)) return "mochila";
  if (/calculadora/.test(text)) return "calculadora";
  if (/resaltador|plum[oó]n|plumones/.test(text)) return "resaltador";
  if (/lapicero|portaminas/.test(text)) return "lapicero";
  if (/l[aá]piz|l[aá]pices|tajador/.test(text)) return "lapices";
  if (/colores/.test(text) && !/t[eé]mpera|acuarela|plastilina/.test(text))
    return "colores";
  if (/borrador/.test(text)) return "borrador";
  if (/regla/.test(text)) return "regla";
  if (/tijera/.test(text)) return "tijera";
  if (/goma|pegamento/.test(text)) return "pegamento";
  if (/folder|mica/.test(text)) return "folder";
  if (/cuaderno|sketchbook/.test(text)) return "cuaderno";
  if (/papel|cartulina/.test(text)) return "papel";
  if (/arte|t[eé]mpera|acuarela|pincel|plastilina/.test(text)) return "arte";
  return "oficina";
}
