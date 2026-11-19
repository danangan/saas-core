import { Bricolage_Grotesque, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";

// The brand's type: Bricolage Grotesque for headings and the logo (playful), Plus Jakarta
// Sans for everything else (friendly and easy to read at length), Geist Mono for code.
// Each sets a CSS variable that globals.css maps to font-heading, font-sans and font-mono.
const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"] });
const sans = Plus_Jakarta_Sans({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/** Classes that define the font variables; put them on <html>. */
export const fontVariables = `${display.variable} ${sans.variable} ${mono.variable}`;
