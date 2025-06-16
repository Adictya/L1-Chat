import { Store } from "@tanstack/store";

export const userDataStore = new Store<{
	userId: string;
    username: string;
    name?: string;
	email?: string;
}>({
	userId: "",
	username: "",
});