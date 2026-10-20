/* SuppVerse BD — customer invoice (A4 PDF) for the web store.
   Same generator as the dashboard app (Header F + Classic Table, paginated, margin-0 export).
   Usage: svInvoice.download(order)  — order is a row from the my_orders RPC. */
(function(){
'use strict';
function escapeHtml(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
/* ====== CUSTOMER INVOICE · A4 — Header F + Classic Table ======
   Full-bleed navy header, paginated into true A4 pages (794x1123) so rows never split across a sheet.
   Web is A4-only (the 80mm Receipt lives in the admin app). Export with PDF margin 0. */
const _CI_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="175 34 748 1043"><path fill="#fff" fill-rule="evenodd" stroke="#fff" stroke-linejoin="round" stroke-width=".3" d="M876.2 171.5c-6.2 0-16.7-5.9-22.9-8.3a279 279 0 0 0-42.9-13 455 455 0 0 0-146.9-7c-62.2 7.2-128.6 26.1-176.9 68-28.2 24.4-46.8 60.2-37.3 98a103 103 0 0 0 20.3 37.7c23.4 29.6 58.7 49 91.3 66.7 55.2 30.1 113.1 55 169 83.9-4 .6-8.6-1.8-12.6-3.2l-22.8-8.2-84.3-29.8q-34-12.3-67.9-25-26.6-10.2-52.8-21.4-21.1-9-41.8-19c-66.4-32.2-142.9-84.7-140.9-167.4a110 110 0 0 1 6.4-33.8C338.9 117.4 414 77.9 484.4 60.8c113.2-27.5 241.9-9.2 337.4 60 20.2 14.6 38 32 54.4 50.7Zm-10.4 6c-7 1-18.7-1-26.3-1.2a325 325 0 0 0-43 2c-61.8 6-131.3 28.8-176.5 73.2-24.1 23.8-41.9 54.9-32.6 89.7 6.8 25.9 27.4 46 46.6 63.3 18.5 16.8 38.8 31.2 58.3 46.6 20.3 15.9 41 31.3 61 47.4-5.9.3-18-7.4-23.9-10.4q-28.6-14.4-57.4-28.6c-37.4-18.6-75.4-35.9-112-56a347 347 0 0 1-65-43c-22.9-20.2-44.3-48.5-39.7-81 6.6-46.8 54.5-80.5 95-97.8A427 427 0 0 1 778.4 153a357 357 0 0 1 60 14c9.1 3 19 5.7 27.3 10.5Zm-601.3 27.6c1 4.7-.9 9.6-1.3 14.4-1 9.6-1.8 19.3-1.2 29a151 151 0 0 0 22.5 66.5c34.8 58.3 101.7 95.4 162.7 120.3 67.4 27.6 137.5 46.6 206.5 69.5 70.3 23.5 138.6 48 191.8 102.2a217 217 0 0 1 38.7 253.7 245 245 0 0 1-36.2 52.9c-4.4 5-9.9 13-15.9 15.9 1-11 4.6-21.9 5.7-33 1.4-13.4.5-27.8-2-41-13.9-72.8-73-125.2-135.2-159.6-76.5-42.3-162.7-63.3-245.3-89.6-46.2-14.8-93.2-31.3-134-58a279 279 0 0 1-58.7-48.4C220 451 193 386 204.2 320.6q4.5-27 16-52a237 237 0 0 1 44.3-63.5Zm-11 129.2-16.5 3.2c2.2 12 3.7 26 10.5 36.4l15.3-6.4zm20 53.7-14.6 9.5a137 137 0 0 0 25.6 32.6l12-10.5zm44 50.8-11.7 12.7c10.3 9.4 26.2 24 38.7 29.7l9.6-13.7c-2.6-4.2-8.8-7.2-13-10.2-8.1-5.8-15.5-12.7-23.6-18.5Zm62 44.1-8.3 14.6c11.8 6.8 33.6 19.2 46.4 22l6.5-16zm375 16.4.2.2.8.8.2.2-.2.3-1-.2-.1-.1-1.7-1zm-302 16.6-6 16.7c10.9 4.6 22.5 8.1 33.7 11.7 4.6 1.5 10.6 4.7 15.3 4l5.1-15.8c-3.3-3.4-10.3-4.4-14.9-5.8-9.7-3.2-23.4-10.2-33.2-10.9Zm79 26.3-5.6 17.3c10.8 4 22.3 6.5 33.4 9.8 5.1 1.5 12.1 4.8 17.4 4.2l4.6-17zm131.7 42.3c-10.2-5.3-22.1-8.5-33-12.1-4.9-1.6-11.7-5.1-16.7-4.7l-6.6 15.8c3.7 3.2 9.8 4 14.5 5.6l35.1 12.2zm32.3 13.3-7.9 15.7 45.9 22.6 9.3-15.6c-4.7-4-11.3-6.3-16.7-9-9.9-5-20-10.7-30.6-13.7Zm-316 24.3c7.3 1.7 14.4 5.6 21.4 8.5l42.8 18.2q23.4 9.7 46.2 20.8 16.5 7.8 32.6 16.4c53 28.4 125.7 71.7 119.4 141.5-4 43-40 76.4-74.8 97-76 45.1-177.5 47.2-261.8 30.9a490 490 0 0 1-61.9-16.3c-8.2-2.7-18.3-4.7-25.5-9.6 7.7-.4 15.8.9 23.6 1.4 15.2 1 30.8 1.1 46 0q25-1.7 50-6c13-2.4 26.5-5.5 39-9.9 41.2-14.1 81-33.5 109-67.9 14.4-17.5 25.4-39.4 24.3-62.6q-1-15.8-6.2-30.7c-12.8-36.5-52.7-72.7-82.3-96.7l-29.5-24.5c-3.8-3-9.9-6.4-12.3-10.5Zm-178 311c8 2 15.5 6 23.3 8.5 19.8 6.5 39.5 13.5 60 18.1 74.3 16.7 144.3 18.8 218.5 0q17-4.3 33.1-10.8c55-21.8 116.4-69 114-134.4q-.4-12.9-4.3-25c-3.6-11.1-8.8-22-15.7-31.4-21.8-30-54.1-51-85.7-69.4a1033 1033 0 0 0-120-57.2c6.8-.7 26.3 7 33.9 9.3 25.8 8 51.6 16 77 25.1 18.3 6.6 36.6 13 54.6 20.4q20.8 8.6 41.2 17.8c69.1 30.9 152.6 85 161.5 167.4a137 137 0 0 1-15.5 77.3c-26.7 51.9-81.9 84.6-136.5 99.7-87.8 24.2-178 16.6-263.8-12-19.6-6.6-39.3-14-57.8-23.2a563 563 0 0 1-87.4-53.7q-11.4-8.5-22-18c-2.6-2.6-6.8-5.2-8.4-8.4Zm571-295.9-11.4 14.3 38.4 29.5 12.5-13.5c-9-9.6-28-24-39.5-30.3Zm61 53.2-14 11.1 21 33.4 16.3-9.4c-5.6-11-14.3-26.8-23.3-35Zm35 60.7-16.6 7.4 8.6 36.2 17-3.7a97 97 0 0 0-5.2-29.7c-1-3.5-1.5-7.6-3.8-10.2Z"/><path fill="#07070c" fill-rule="evenodd" stroke="#07070c" stroke-linejoin="round" stroke-width=".3" d="M896 185.5c-.7 1.5-1.4 3.2-3.1 3.9-3.8 1.5-15.8-2-20.4-2.5a375 375 0 0 0-71-.7c-56 5.3-112.1 22.5-157.7 56.2-22.8 16.8-44 39.4-49.5 68.2-4.8 24.5 7.2 46.2 22.2 64.4 12.1 14.7 26.9 26.4 41.4 38.6 22.3 18.5 45.6 35.9 68.7 53.3 17.8 13.5 35 27.8 52.7 41.3 4.2 3.2 17.7 11.2 9.4 17-3.2 2.2-7 .1-10.3-1l-24.5-8.7a5808 5808 0 0 0-100-34.9 2821 2821 0 0 1-148.6-55.4c-44.4-17.6-90.2-37.6-128.4-66.6-40.4-30.8-74.2-69.2-78.6-122.1-1-12.5.7-24.9 3.5-37 12.7-54.7 58.4-97 107.7-120.5 115.5-55.5 257.2-50.6 371 7 33.7 17 64.2 39.5 90.4 66.6 8.2 8.6 21.8 21.4 25.1 32.9Zm-19.8-14a327 327 0 0 0-54.5-50.7c-95.5-69.2-224.1-87.5-337.3-60C414 78 338.9 117.4 313.2 189.7a110 110 0 0 0-6.4 33.8c-2 82.7 74.5 135.2 140.9 167.3a974 974 0 0 0 41.8 19.1q26.1 11.3 52.8 21.3 33.9 13 68 25.1l84.2 29.8 22.8 8.2c4 1.4 8.6 3.8 12.7 3.2-56-28.8-113.9-53.8-169.1-83.9-32.6-17.7-68-37.1-91.3-66.7a103 103 0 0 1-20.3-37.6c-9.5-37.9 9-73.7 37.3-98.2 48.3-41.8 114.7-60.7 177-67.9q74-8.3 146.8 7c14.5 3 29 7.7 42.9 13 6.2 2.4 16.7 8.3 22.9 8.3Zm-10.4 6c-8.3-4.8-18.2-7.5-27.3-10.5a357 357 0 0 0-60-14 427 427 0 0 0-228.3 28.7c-40.4 17.3-88.4 51-95 97.9-4.5 32.4 17 60.7 39.7 81a347 347 0 0 0 65 43c36.7 20 74.7 37.3 112.1 56q28.8 14.1 57.4 28.5c6 3 18 10.6 24 10.4-20.1-16.1-40.8-31.5-61-47.4-19.6-15.4-40-29.8-58.4-46.6-19.2-17.3-39.8-37.4-46.6-63.3-9.3-34.8 8.5-66 32.6-89.7 45.2-44.4 114.7-67.2 176.5-73.2a325 325 0 0 1 43-2c7.6.3 19.3 2.1 26.3 1.2ZM274.5 187c1.2.7 2.6 1.3 3 2.8 1.2 3.6-3 15.1-4 19.4-4 20.8-3.9 40.3.9 61 10.7 47 52 88.4 91.2 113.8 64.9 42 139.2 66 212.6 88.4q39.8 12.4 79.6 25.3c70 22.3 134.6 47.7 189 99 82.6 78.1 92.4 203.2 28.3 296q-13.6 19.5-30.4 36.5c-4.4 4.4-8.8 9.5-13.8 13.2-4.6 3.3-10.5 1.2-10.5-4.9 0-3.3 1.7-6.9 2.6-10a150 150 0 0 0 3.6-75.7c-13-60.4-59.1-104.5-109.2-136.7-88.5-56.8-199.2-76.4-297-112-63-22.7-121.8-49.8-167-101a275 275 0 0 1-34.9-51.1 211 211 0 0 1-18.2-152.4 242 242 0 0 1 25.2-57.6 200 200 0 0 1 33-42c4.4-4.4 9.7-11 16-12Zm-10 18.1a236 236 0 0 0-44.3 63.6c-7.6 16.4-13 34-16 51.9C193 386 219.9 451 262.6 499.9c16.7 19 37.5 34.7 58.6 48.4 40.9 26.7 88 43.2 134 58 82.7 26.3 169 47.3 245.4 89.6 62.2 34.4 121.3 86.8 135.2 159.7 2.5 13.1 3.4 27.5 2 40.9-1.1 11.1-4.6 22-5.7 33 6-2.8 11.5-11 16-16q21.5-24 36.1-52.8A217 217 0 0 0 845.5 607c-53.2-54.1-121.5-78.7-191.9-102.2-69-22.9-139-42-206.4-69.5-61-25-128-62-162.7-120.3a151 151 0 0 1-22.5-66.5c-.6-9.7.2-19.4 1.2-29 .4-4.8 2.2-9.7 1.3-14.4Zm-11 129.2 9.3 33.2-15.3 6.4c-6.8-10.5-8.3-24.4-10.5-36.4zm20 53.7 23 31.6-12 10.5a137 137 0 0 1-25.6-32.6zm44 50.8c8.1 5.8 15.5 12.7 23.7 18.5 4.1 3 10.3 6 13 10.2l-9.7 13.7c-12.5-5.7-28.4-20.2-38.7-29.7zm62 44.1 44.6 20.6-6.5 16c-12.8-2.8-34.6-15.2-46.4-22zm375 16.4-1.8.2 1.7 1 .1.1 1 .2.2-.3-.2-.2-.8-.8zm-302 16.6c9.8.6 23.4 7.6 33.3 10.8 4.5 1.4 11.5 2.4 14.8 5.8l-5.1 15.8c-4.7.7-10.7-2.5-15.3-4-11.2-3.6-22.8-7-33.7-11.7zm79 26.3 49.8 14.3-4.6 17c-5.3.6-12.3-2.7-17.4-4.2-11-3.3-22.6-5.8-33.4-9.8zm131.7 42.3-6.7 16.8c-11.7-3.9-23.3-8.3-35-12.2-4.8-1.6-11-2.4-14.6-5.6l6.6-15.8c5-.5 11.8 3.1 16.6 4.7 11 3.6 22.9 6.8 33 12.1Zm32.3 13.3c10.6 3 20.7 8.7 30.6 13.7 5.4 2.7 12 5 16.7 9l-9.3 15.6-45.9-22.6zM357.7 604c3.3-1 7.6 1 10.8 1.9q14 3.8 28 8c34 9.7 67.8 19.5 101.3 30.6 22.4 7.4 44.5 15.5 66.8 23.2q27 9.5 53 21.1a657 657 0 0 1 38.7 18.3c64.1 33.3 133.2 82 144 159.3a135 135 0 0 1-8.8 71.5 163 163 0 0 1-34.1 52.9c-41.4 43-99.7 66.4-157.9 75.4-101.7 15.7-206.6-6-297.7-52.6a477 477 0 0 1-93.3-62.7q-10.2-8.7-19.6-18.4c-2.3-2.3-6.6-5.2-7.4-8.5s1.6-7 5-7.3c5.6-.5 14.5 2 20.3 2.7q45.7 5.5 91.7 2.4c54.2-3.9 119-22.9 160.5-59.4 18.1-16 34.9-35 40.7-59.2 12-50-32.1-94.2-66-124.5a695 695 0 0 0-22.6-19.4c-16.1-13.2-31.9-26.9-48.5-39.5-4.1-3.1-10.4-6-8.3-12.2.5-1.3 2-3.1 3.3-3.6Zm21.8 18c2.4 4 8.5 7.4 12.3 10.5l29.5 24.5c29.6 24 69.5 60.2 82.3 96.7q5.3 14.9 6.2 30.7c1.1 23.2-10 45.1-24.2 62.6-28.2 34.4-68 53.8-109.1 68-12.5 4.3-26 7.4-39 9.7q-25 4.5-50 6.1c-15.2 1.1-30.8 1-46 0-7.8-.5-15.9-1.8-23.6-1.4 7.2 4.9 17.3 6.9 25.5 9.6a490 490 0 0 0 61.9 16.3c84.3 16.3 185.9 14.3 261.8-30.8 34.9-20.7 70.8-54.1 74.8-97.1 6.3-69.8-66.4-113.1-119.4-141.5q-16.1-8.6-32.6-16.4a838 838 0 0 0-46.2-20.8c-14.3-5.9-28.5-12.3-42.8-18.2-7-2.9-14-6.8-21.4-8.5Zm-178 311c1.6 3.3 5.8 6 8.5 8.4q10.5 9.7 21.9 18a563 563 0 0 0 87.4 53.8 447 447 0 0 0 57.8 23.1c85.8 28.7 176 36.3 263.8 12 54.6-15 109.8-47.8 136.5-99.6a137 137 0 0 0 15.5-77.3c-9-82.4-92.4-136.5-161.5-167.4q-20.5-9.2-41.2-17.8c-18-7.3-36.3-13.8-54.6-20.4q-38.2-13.5-77-25c-7.6-2.4-27.1-10-33.8-9.4a1033 1033 0 0 1 120 57.2c31.5 18.5 63.8 39.4 85.6 69.4 6.9 9.4 12.1 20.3 15.7 31.3q3.9 12.3 4.3 25.1c2.4 65.5-59 112.6-114 134.4q-16.3 6.5-33.1 10.8c-74.2 18.8-144.2 16.7-218.6 0-20.4-4.6-40-11.6-59.9-18-7.8-2.6-15.3-6.7-23.3-8.5Zm571-295.9a196 196 0 0 1 39.5 30.3L799.5 681l-38.4-29.5zm61 53.2c9 8.3 17.7 24.2 23.3 35.1l-16.3 9.4-21-33.4zm35 60.7c2.3 2.6 2.8 6.7 3.8 10.2a97 97 0 0 1 5.2 29.7l-17 3.7-8.6-36.2z"/></svg>`;
const _CI_PJ = "font-family:'Plus Jakarta Sans',sans-serif";
/* same recipe as the web .header (violet glow top-left over a navy vertical gradient), flattened: no inset highlights, no drop shadow */
const _CI_NAVY = 'radial-gradient(ellipse 60% 110% at -5% 0%,rgba(124,111,247,.18) 0%,transparent 60%),linear-gradient(180deg,#0c2d52 0%,#002248 45%,#001f3c 100%)';
const _CI_PAGE_H = 1123;
const _ciMoney = n => '\u09f3' + Number(n).toLocaleString('en-IN');
const _CI_TXB = {
  paid:    { c:'#2f9b68', bg:'rgba(47,155,104,.12)',  b:'rgba(47,155,104,.3)',  t:'Paid' },
  pending: { c:'#d48c0a', bg:'rgba(244,169,34,.12)',  b:'rgba(244,169,34,.3)',  t:'Pending' },
  shipped: { c:'#4338ca', bg:'rgba(79,70,229,.12)',   b:'rgba(79,70,229,.3)',   t:'Shipped' }
};
const _CI_IC = {
  user: '<path d="M21,19a3,3,0,0,1-3,3H6a3,3,0,0,1-3-3,5,5,0,0,1,5-5h8A5,5,0,0,1,21,19Zm-9-7A5,5,0,1,0,7,7,5,5,0,0,0,12,12Z"/>',
  phone: '<path d="M3 5.5C3 14.0604 9.93959 21 18.5 21C18.8862 21 19.2691 20.9859 19.6483 20.9581C20.0834 20.9262 20.3009 20.9103 20.499 20.7963C20.663 20.7019 20.8185 20.5345 20.9007 20.364C21 20.1582 21 19.9181 21 19.438V16.6207C21 16.2169 21 16.015 20.9335 15.842C20.8749 15.6891 20.7795 15.553 20.6559 15.4456C20.516 15.324 20.3262 15.255 19.9468 15.117L16.74 13.9509C16.2985 13.7904 16.0777 13.7101 15.8683 13.7237C15.6836 13.7357 15.5059 13.7988 15.3549 13.9058C15.1837 14.0271 15.0629 14.2285 14.8212 14.6314L14 16C11.3501 14.7999 9.2019 12.6489 8 10L9.36863 9.17882C9.77145 8.93713 9.97286 8.81628 10.0942 8.64506C10.2012 8.49408 10.2643 8.31637 10.2763 8.1317C10.2899 7.92227 10.2096 7.70153 10.0491 7.26005L8.88299 4.05321C8.745 3.67376 8.67601 3.48403 8.55442 3.3441C8.44701 3.22049 8.31089 3.12515 8.15802 3.06645C7.98496 3 7.78308 3 7.37932 3H4.56201C4.08188 3 3.84181 3 3.63598 3.09925C3.4655 3.18146 3.29814 3.33701 3.2037 3.50103C3.08968 3.69907 3.07375 3.91662 3.04189 4.35173C3.01413 4.73086 3 5.11378 3 5.5Z"/>',
  pin: '<path d="M12 21C15.5 17.4 19 14.1764 19 10.2C19 6.22355 15.866 3 12 3C8.13401 3 5 6.22355 5 10.2C5 14.1764 8.5 17.4 12 21Z"/><path d="M12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13Z"/>'
};
const _CI_MI = {
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>'
};

/* Brand lockup — geometry copied from the website .header-logo (icon 44.8px tall), scaled by k */
function _ciLockup(h, tc, bdc, b, ih) {
  b = b || 0; ih = h + (ih || 0);
  const k = h / 44.8, w = Math.round(ih * 748 / 1043), r = n => (n * k).toFixed(2);
  const F = "font-family:'BARABARA-FINAL','DM Sans',sans-serif";
  return `<div style="display:flex;align-items:center;gap:${r(9.1)}px"><span style="display:block;flex-shrink:0;width:${w}px;height:${ih}px;line-height:0;position:relative;top:-3px">${_CI_LOGO_SVG.replace('<svg ', '<svg width="' + w + '" height="' + ih + '" style="display:block" ')}</span><div style="transform:translateY(${(5.3*k-2).toFixed(2)}px);line-height:1"><div style="${F};font-size:${(16.6*k+b).toFixed(2)}px;font-weight:800;color:${tc};letter-spacing:${r(1)}px;line-height:1;white-space:nowrap">SUPPVERSE</div><div style="${F};font-size:${(10.6*k+b*0.6).toFixed(2)}px;font-weight:700;color:${bdc};letter-spacing:.22em;line-height:1;margin-left:${r(1)}px">BD</div></div></div>`;
}
const _ciPill = s => { const x = _CI_TXB[s] || _CI_TXB.paid; return `<span style="display:inline-block;${_CI_PJ};font-size:12px;font-weight:700;padding:4px 14px;border-radius:999px;border:1px solid ${x.b};background:${x.bg};color:${x.c};line-height:1.2">${x.t}</span>`; };
const _CI_TONE = {
  g: ['#2f9b68', 'rgba(47,155,104,.12)', 'rgba(47,155,104,.35)'],
  a: ['#a86400', 'rgba(232,160,32,.16)', 'rgba(200,130,10,.4)'],
  c: ['#0A9BDC', 'rgba(10,155,220,.1)', 'rgba(10,155,220,.4)'],
  p: ['#6a5de6', 'rgba(124,111,247,.12)', 'rgba(124,111,247,.35)']
};
const _CI_STAGE = { processing: ['Processing', 'c'], shipped: ['Shipped', 'p'], delivered: ['Delivered', 'g'] };
function _ciBadge(t, k) {
  const c = _CI_TONE[k] || _CI_TONE.g;
  return `<span style="display:inline-block;${_CI_PJ};font-size:12px;font-weight:700;padding:4px 14px;border-radius:999px;border:1px solid ${c[2]};background:${c[1]};color:${c[0]};line-height:1.2;white-space:nowrap">${t}</span>`;
}
/* payment badge (Paid / COD due) + order stage badge, side by side */
function _ciPills(inv) {
  const due = _ciMoney(inv.amountDue != null ? inv.amountDue : (inv.total || 0));
  const pay = inv.payType === 'cod' && !inv.paid ? ['COD \u00b7 ' + due + ' due', 'a'] : ['Paid', 'g'];
  const stg = _CI_STAGE[inv.stage];
  return `<span style="display:inline-flex;gap:6px;align-items:center">${stg ? _ciBadge(stg[0], stg[1]) : ''}${_ciBadge(pay[0], pay[1])}</span>`;
}
const _ciChip = (d, solid) => `<span style="flex:none;width:26px;height:26px;border-radius:8px;background:#eef2f8;display:inline-flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" style="${solid ? 'fill:#001f3c;stroke:none' : 'fill:none;stroke:#001f3c;stroke-width:2.3;stroke-linecap:butt;stroke-linejoin:round'}">${d}</svg></span>`;
/* Order ID badge — mirrors the LOCKED .order-id-badge (SV-) and .tracking-tag (PX- proxy), inlined for PDF */
const _ciOrderBadge = id => {
  id = escapeHtml(id || '');
  return id.indexOf('PX-') === 0
    ? `<span style="display:inline-flex;align-items:center;background:rgba(255,255,255,.55);border:1.5px dashed rgba(198,82,39,.45);border-radius:6px;padding:4px 10px;line-height:1"><span style="${_CI_PJ};font-size:14px;font-weight:800;color:#E15A26;letter-spacing:.3px;line-height:1">${id}</span></span>`
    : `<span style="display:inline-flex;align-items:center;justify-content:center;${_CI_PJ};font-size:14px;font-weight:800;color:#0A9BDC;background:rgba(10,155,220,.12);border:1px solid rgba(10,155,220,.38);border-radius:6px;padding:4px 10px;letter-spacing:.3px;line-height:1">${id}</span>`;
};

/* Math section — same rules as svDiscShipRows(): ship-voucher => no Discount row, struck fee + FREE; customer view = green */
function _ciMath(x, inv) {
  const G = '#0A9B72', sv = !!inv.shipVoucher, code = inv.voucher ? ' (' + escapeHtml(inv.voucher) + ')' : '';
  const free = sv ? x.d > 0 : x.s === 0, was = sv ? Math.max(x.s, 0) : 0;
  const ic = (d, sw) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw || 2}" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">${d}</svg>`;
  const row = (color, icon, label, val, valCss, sw) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 18px 5px 0;font-size:14px;font-weight:500;color:${color}"><span style="display:flex;align-items:center;gap:6px">${ic(icon, sw)}${label}</span><span style="font-weight:600;color:${color};${valCss || ''}">${val}</span></div>`;
  const discRow = (!sv && x.d > 0) ? row(G, _CI_MI.tag, 'Discount' + code, '-' + _ciMoney(x.d)) : '';
  const shipLbl = sv && x.d > 0 ? 'Shipping' + code : 'Shipping';
  const shipRow = free
    ? row(G, _CI_MI.truck, shipLbl, (was > 0 ? '<s style="font-size:13px;font-weight:600;opacity:.6;margin-right:6px;letter-spacing:0">' + _ciMoney(was) + '</s>' : '') + 'FREE', 'font-weight:700;letter-spacing:.5px;font-size:12px', 1.8)
    : row('#1a2744', _CI_MI.truck, shipLbl, _ciMoney(x.s), '', 1.8);
  return `<div style="width:340px">
  <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 18px 5px 0;font-size:14px;font-weight:500;color:#1a2744"><span>Subtotal</span><span style="font-weight:600;color:#001f3c">${x.units}u \u00d7 ${_ciMoney(x.sub)}</span></div>
  ${discRow}${shipRow}
  <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 18px 2px 0;margin-top:5px;border-top:2px solid #001f3c"><span style="font-size:14px;font-weight:600;color:#001f3c">Total</span><span style="${_CI_PJ};font-size:20px;font-weight:700;color:#001f3c">${_ciMoney(x.grand)}</span></div>
</div>`;
}

function _ciRow(i, sl, last) {
  const bd = last ? '1.5px solid #001f3c' : '1px solid #eef1f6', zb = sl % 2 === 0 ? 'background:#f7f9fc;' : '';
  const dm = "font-family:'DM Sans',sans-serif";
  return `<tr><td style="padding:14px 0 14px 18px;border-bottom:${bd};${zb}"><span style="${_CI_PJ};font-size:15px;font-weight:800;color:#001f3c">${sl}</span></td>
  <td style="padding:14px 8px;border-bottom:${bd};${zb}"><div style="${_CI_PJ};font-size:14.5px;font-weight:700;line-height:1.35">${escapeHtml(i.name)}</div>${i.variant ? `<div style="font-size:11.5px;font-weight:600;color:#8c92a1;margin-top:3px">${escapeHtml(i.variant)}</div>` : ''}</td>
  <td style="padding:14px 8px;border-bottom:${bd};${zb}text-align:center;${dm};font-size:14.5px;font-weight:700;color:#4a5568">${i.qty}</td>
  <td style="padding:14px 8px;border-bottom:${bd};${zb}text-align:right;${dm};font-size:14.5px;font-weight:700;color:#4a5568">${_ciMoney(i.each)}</td>
  <td style="padding:14px 18px 14px 8px;border-bottom:${bd};${zb}text-align:right;${dm};font-size:15px;font-weight:700;color:#001f3c">${_ciMoney(i.total)}</td></tr>`;
}
function _ciThead() {
  const th = (t, al, w, pad, r, seam) => `<th style="width:${w};height:14px;line-height:14px;vertical-align:middle;text-align:${al};padding:${pad};background:#001f3c;${seam === false ? '' : 'box-shadow:1px 0 0 #001f3c;'}${r || ''}${_CI_PJ};font-size:10px;font-weight:800;letter-spacing:.12em;color:#fff">${t}</th>`;
  return `<thead><tr style="background:#001f3c">${th('SL', 'left', '52px', '12px 0 12px 18px', 'border-radius:10px 0 0 10px;')}${th('PRODUCT', 'left', 'auto', '12px 8px')}${th('QTY', 'center', '56px', '12px 8px')}${th('UNIT PRICE', 'right', '104px', '12px 8px')}${th('AMOUNT', 'right', '116px', '12px 18px 12px 8px', 'border-radius:0 10px 10px 0;', false)}</tr></thead>`;
}
function _ciIntro(inv) {
  return `<div>
  <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
    <span style="flex:1;height:1px;background:linear-gradient(90deg,transparent,#001f3c)"></span>
    <span style="${_CI_PJ};font-size:10px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;padding-left:.22em">Invoice</span>
    <span style="flex:1;height:1px;background:linear-gradient(270deg,transparent,#001f3c)"></span>
  </div>
  <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:24px;row-gap:8px;align-items:center;padding-bottom:14px;border-bottom:1.5px solid #cdd5e3">
    <div style="${_CI_PJ};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8c92a1">Bill To</div><div style="${_CI_PJ};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8c92a1;text-align:right">Order Details</div>
    <div style="display:flex;align-items:center;gap:10px;min-height:26px">${_ciChip(_CI_IC.user, true)}<span style="${_CI_PJ};font-size:17px;font-weight:700">${escapeHtml(inv.customerName || '')}</span></div>
    <div style="display:flex;justify-content:flex-end;align-items:center">${_ciOrderBadge(inv.linkedDraftId)}</div>
    <div style="display:flex;align-items:center;gap:10px;min-height:26px">${_ciChip(_CI_IC.phone)}<span style="font-size:14px;font-weight:600">${escapeHtml(inv.customerPhone || '')}</span></div>
    <div style="display:flex;justify-content:flex-end;align-items:center">${_ciPills(inv)}</div>
    <div style="display:flex;align-items:center;gap:10px;min-height:26px">${_ciChip(_CI_IC.pin)}<span style="font-size:14px;font-weight:600;line-height:1.4">${escapeHtml(inv.customerLocation || '')}</span></div>
    <div style="display:flex;justify-content:flex-end;align-items:center;font-size:14px;font-weight:700;color:#001f3c">${escapeHtml(inv.date || '')}</div>
  </div></div>`;
}
/* Header F — flat navy band (web header style), left-aligned white lockup */
function _ciHeaderF(total) {
  return `<div style="position:relative;height:116px;overflow:hidden;background:${_CI_NAVY};flex-shrink:0">
  <div style="position:relative;z-index:1;height:100%;display:flex;align-items:center;justify-content:space-between;padding:0 56px 0 30px">
    ${_ciLockup(70, '#fff', '#fff', 4, 4)}
    ${total > 1 ? `<span style="${_CI_PJ};font-size:11px;font-weight:700;letter-spacing:.08em;color:rgba(255,255,255,.6)">PAGE 1 OF ${total}</span>` : ''}
  </div>
</div>`;
}
/* Slim continuation header for pages 2+ */
function _ciContHeader(inv, pg, total) {
  return `<div style="position:relative;height:60px;overflow:hidden;background:${_CI_NAVY};flex-shrink:0">
  <div style="position:relative;z-index:1;height:100%;display:flex;align-items:center;justify-content:space-between;padding:0 56px 0 30px">
    ${_ciLockup(34, '#fff', '#fff')}
    <span style="${_CI_PJ};font-size:11px;font-weight:700;letter-spacing:.08em;color:rgba(255,255,255,.7)">${escapeHtml(inv.linkedDraftId || '')} \u00b7 PAGE ${pg} OF ${total}</span>
  </div>
</div>`;
}
function _ciFooter() {
  return `<div style="flex-shrink:0;background:rgba(0,31,60,.14);padding:14px 56px;text-align:center"><div style="${_CI_PJ};font-size:13px;font-weight:700;color:#001f3c">Thank you for choosing SuppVerse BD</div><div style="font-size:10px;color:#6b7690;margin-top:3px">Generated by SuppVerse System \u00b7 ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Dhaka'})}</div></div>`;
}

/* Web-store theme (cyan standalone): re-colours the finished markup — layout and pagination are identical */
const _CI_WEB_CYAN = '#009ddc', _CI_WEB_CYAN_DK = '#0087bf', _CI_WEB_INK = '#0a1628';
function _ciApplyWebTheme(h) {
  const grad = 'linear-gradient(135deg,#19b6f0 0%,#009ddc 45%,#0079b0 100%)';
  return h.split(_CI_NAVY).join(grad)
    .split('background:#001f3c').join('background:' + _CI_WEB_CYAN_DK)
    .split('solid #001f3c').join('solid ' + _CI_WEB_CYAN_DK)
    .split('transparent,#001f3c').join('transparent,' + _CI_WEB_CYAN_DK)
    .split('1px 0 0 #001f3c').join('1px 0 0 ' + _CI_WEB_CYAN_DK)
    .split('#001f3c').join(_CI_WEB_INK)
    .split('rgba(124,111,247,.35)').join('rgba(255,255,255,.22)')
    .split('#38bdf8').join('#ffffff')
    .split('#7c6ff7').join(_CI_WEB_CYAN)
    .split('rgba(0,31,60,.14)').join('rgba(0,157,220,.10)');
}
function generateCustomerInvoiceHTML(inv, size, theme) {
  size = 'a4';  /* RULE: web invoices are always A4. The Receipt (80mm) size exists only in the admin app. */

  const items = inv.items || [], n = items.length;
  const sub = items.reduce((a, i) => a + i.total, 0), d = inv.discount || 0, s = inv.shipping || 0;
  const x = { sub: inv.subtotal != null ? Number(inv.subtotal) : sub, d, s, grand: inv.total != null ? Number(inv.total) : sub - d + s, units: items.reduce((a, i) => a + i.qty, 0) };
  const rows = items.map((it, k) => _ciRow(it, k + 1, k === n - 1));
  const intro = _ciIntro(inv), thead = _ciThead(), footer = _ciFooter();
  const mathWrap = `<div style="display:flex;justify-content:flex-end;padding-top:24px">${_ciMath(x, inv)}</div>`;
  const tbl = (from, to) => `<table style="width:100%;table-layout:fixed;border-collapse:separate;border-spacing:0">${thead}<tbody>${rows.slice(from, to).join('')}</tbody></table>`;

  /* --- measure real heights off-screen (fonts are already loaded in the app) --- */
  const H = _CI_PAGE_H, PAD_B = 40;
  let introH = 150, theadH = 38, mathH = 190, footH = 56, contH = 60, rh = rows.map(() => 52);
  const m = document.createElement('div');
  m.style.cssText = 'position:absolute;left:-10000px;top:0;width:794px;visibility:hidden;pointer-events:none';
  m.innerHTML = `<div style="padding:0 56px">${intro}</div><div style="padding:0 56px">${tbl(0, n)}</div><div style="padding:0 56px">${mathWrap}</div>${footer}${_ciContHeader(inv, 2, 2)}`;
  document.body.appendChild(m);
  try {
    const k = m.children;
    introH = k[0].offsetHeight || introH;
    theadH = k[1].querySelector('thead').offsetHeight || theadH;
    const measured = Array.from(k[1].querySelectorAll('tbody tr')).map(tr => tr.offsetHeight);
    if (measured.length === n && measured.every(h => h > 0)) rh = measured;
    mathH = k[2].offsetHeight || mathH;
    footH = k[3].offsetHeight || footH;
    contH = k[4].offsetHeight || contH;
  } finally { m.remove(); }

  /* --- paginate: header repeats per page, totals + footer only on the last page --- */
  const av1 = H - 116 - 18 - introH - 22 - theadH - PAD_B;
  const avC = H - contH - 28 - theadH - PAD_B;
  const pages = [];
  let i = 0, first = true, hasLast = false;
  while (i < n) {
    const avN = first ? av1 : avC;
    const avL = avN + PAD_B - mathH - footH - 12;
    let tot = 0; for (let q = i; q < n; q++) tot += rh[q];
    if (tot <= avL) { pages.push([i, n, true]); hasLast = true; break; }
    let j = i, acc = 0;
    while (j < n && acc + rh[j] <= avN) { acc += rh[j]; j++; }
    if (j === i) j = i + 1;                       /* a row taller than a page: force progress */
    if (j === n && n - i > 1) j = n - 1;          /* keep the last row with the totals, never alone on a page */
    pages.push([i, j, false]); i = j; first = false;
  }
  if (!hasLast) pages.push([n, n, true]);
  const N = pages.length;

  const pageHTML = (p, idx) => {
    const isFirst = idx === 0, isLast = p[2];
    /* last page is 3px short so rounding never spills an extra blank sheet */
    const ph = isLast ? H - 3 : H;
    const table = (p[1] > p[0] || isFirst) ? `<div style="padding-top:${isFirst ? 22 : 0}px">${tbl(p[0], p[1])}</div>` : '';
    return `<div style="width:794px;height:${ph}px;overflow:hidden;display:flex;flex-direction:column;background:#fff;color:#001f3c;font-family:'DM Sans',sans-serif">
  ${isFirst ? _ciHeaderF(N) : _ciContHeader(inv, idx + 1, N)}
  <div style="padding:${isFirst ? '18px 56px 0' : '28px 56px 0'};flex:1;display:flex;flex-direction:column">${isFirst ? intro : ''}${table}${isLast ? mathWrap : ''}</div>
  ${isLast ? footer : ''}
</div>`;
  };
  const out = '<div style="width:794px">' + pages.map(pageHTML).join('') + '</div>';
  return theme === 'web' ? _ciApplyWebTheme(out) : out;
}


function fmtDate(iso){
  try{ return new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric', timeZone:'Asia/Dhaka' }); }catch(e){ return ''; }
}
/* my_orders row -> invoice model */
function mapOrder(o){
  var c = o.customer || {};
  var items = (o.items || []).map(function(i){
    var qty = Number(i.qty) || 1, each = Number(i.price) || 0;
    return { name: i.name, variant: i.variant || '', qty: qty, each: each, total: each * qty };
  });
  return {
    linkedDraftId: o.order_number,
    customerName: c.name || '', customerPhone: c.phone || '', customerLocation: c.address || '',
    items: items,
    subtotal: o.subtotal, total: o.total,
    discount: Number(o.discount) || 0, voucher: o.voucher_code || null, shipVoucher: !!o.ship_voucher,
    shipping: Number(o.shipping) || 0,
    status: o.state === 'shipped' ? 'shipped' : 'paid',
    payType: o.payment_method === 'cod' ? 'cod' : 'prepaid',
    paid: o.payment_method === 'cod' ? (o.state === 'delivered' || o.state === 'paid') : true,
    amountDue: (o.payment_method === 'cod' && !(o.state === 'delivered' || o.state === 'paid')) ? Number(o.total) || 0 : 0,
    stage: o.state || '',
    date: fmtDate(o.paid_at || o.created_at)
  };
}
/* Save PDF + visible in-app confirmation (browsers may download silently, e.g. after async fetch / PWA) */
function svPdfSaved(blob, filename, accent){
  var url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  var old = document.getElementById('_svPdfDone'); if(old) old.remove();
  var c = document.createElement('div'); c.id = '_svPdfDone'; c.setAttribute('role','status'); c.setAttribute('aria-live','polite');
  c.style.cssText = "position:fixed;left:12px;right:12px;bottom:calc(16px + env(safe-area-inset-bottom,0px));max-width:420px;margin:0 auto;z-index:2147483647;background:#0f1e3c;color:#fff;border-radius:16px;padding:12px 12px 12px 14px;display:flex;align-items:center;gap:12px;box-shadow:0 12px 32px rgba(0,0,0,.35);font:600 13px/1.3 'DM Sans',system-ui,sans-serif;transform:translateY(24px);opacity:0;transition:transform .25s ease,opacity .25s ease";
  var ic = document.createElement('div');
  ic.style.cssText = 'flex:none;width:32px;height:32px;border-radius:50%;background:' + accent + ';display:flex;align-items:center;justify-content:center';
  ic.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';
  var tx = document.createElement('div'); tx.style.cssText = 'flex:1;min-width:0';
  var t1 = document.createElement('div'); t1.style.fontWeight = '800'; t1.textContent = 'PDF saved to Downloads';
  var t2 = document.createElement('div'); t2.style.cssText = 'opacity:.7;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'; t2.textContent = filename;
  tx.appendChild(t1); tx.appendChild(t2);
  var bs = 'flex:none;border:0;border-radius:10px;padding:9px 12px;font:800 12px/1 inherit;color:#fff;text-decoration:none;cursor:pointer;';
  var op = document.createElement('a'); op.href = url; op.target = '_blank'; op.rel = 'noopener'; op.textContent = 'Open';
  op.style.cssText = bs + 'background:' + accent;
  c.appendChild(ic); c.appendChild(tx); c.appendChild(op);
  var file = null;
  try{ file = new File([blob], filename, { type:'application/pdf' }); }catch(e){}
  if(file && navigator.canShare && navigator.canShare({ files:[file] })){
    var sh = document.createElement('button'); sh.type = 'button'; sh.textContent = 'Share';
    sh.style.cssText = bs + 'background:rgba(255,255,255,.14)';
    sh.onclick = function(){ navigator.share({ files:[file], title:filename }).catch(function(){}); };
    c.appendChild(sh);
  }
  var done = function(){ c.style.opacity = '0'; setTimeout(function(){ c.remove(); URL.revokeObjectURL(url); }, 300); };
  var x = document.createElement('button'); x.type = 'button'; x.setAttribute('aria-label','Dismiss'); x.textContent = '\u2715';
  x.style.cssText = 'flex:none;background:none;border:0;color:#fff;opacity:.6;font-size:14px;padding:6px;cursor:pointer';
  x.onclick = done; c.appendChild(x);
  document.body.appendChild(c);
  requestAnimationFrame(function(){ c.style.transform = 'none'; c.style.opacity = '1'; });
  setTimeout(done, 15000);
}
/* Preferred path: server renders a true vector PDF (selectable text, sharp at any zoom) */
function serverDownload(o){
  var sb = (typeof sbClient !== 'undefined') ? sbClient : null;
  if(!sb || !window.fetch) return Promise.reject(new Error('Not signed in'));
  return sb.auth.getSession().then(function(r){
    var t = r && r.data && r.data.session && r.data.session.access_token;
    if(!t) throw new Error('no session');
    return fetch('/api/invoice', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer ' + t }, body: JSON.stringify({ id: o.id }) });
  }).then(function(res){
    if(!res.ok) return res.json().catch(function(){ return {}; }).then(function(j){ var e = new Error((j && j.error) || ('Server error ' + res.status)); e.userMessage = (j && j.error) || ''; throw e; });
    return res.blob();
  }).then(function(blob){
    if(!blob || blob.type.indexOf('pdf') < 0) throw new Error('bad pdf');
    svPdfSaved(blob, 'suppverse-invoice-' + String(o.order_number || 'order').replace(/[^A-Za-z0-9_-]/g, '') + '.pdf', '#009ddc');
  });
}
function download(o){ return serverDownload(o); }
window.svInvoice = { html: function(o){ return generateCustomerInvoiceHTML(mapOrder(o), 'a4'); }, download: download };
})();
