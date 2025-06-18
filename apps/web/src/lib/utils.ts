import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function u(i: string) {
	return `http://localhost:3000${i}`;
}

export const iN = (x: number) => {
	return isNaN(x) ? 0 : x;
};

export function prettyPrintNumber(num?: number) {
	if (num !== 0 && !num) return "0";
	if (isNaN(num)) {
		return "0";
	}
	if (num >= 1_000_000) {
		return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
	} else if (num >= 1000) {
		return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
	}
	return num.toString();
}
