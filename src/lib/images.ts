// Les images envoyées sur Cloudinary sont redimensionnées et converties (WebP/AVIF) à la volée.
// Un lien externe (collé par le club) est renvoyé tel quel.
const UPLOAD = "/image/upload/";

export function imageUrl(url: string, width: number) {
  if (!url.startsWith("https://res.cloudinary.com/") || !url.includes(UPLOAD)) return url;
  return url.replace(UPLOAD, `${UPLOAD}f_auto,q_auto,c_limit,w_${width}/`);
}
