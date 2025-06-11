import {
	useLiveIncrementalQuery,
	useLiveQuery,
} from "@electric-sql/pglite-react";
import type { Query } from "drizzle-orm";

interface LoadingState {
	status: "loading";
	data: [];
}

interface SuccessState<T> {
	status: "success";
	data: T[];
}

type SubscriptionResult<T> = LoadingState | SuccessState<T>;

export const useSubscription = <T>(query: Query): SubscriptionResult<T> => {
	const sql = query;

	const res = useLiveQuery(sql.sql, sql.params);
	if (!res) {
		return {
			status: "loading",
			data: [],
		};
	}

	return {
		status: "success",
		data: res.rows as T[],
	};
};

export const useSubscriptionInc = <T>(
	query: Query,
	key: string,
): SubscriptionResult<T> => {
	const sql = query;

	const res = useLiveIncrementalQuery(sql.sql, sql.params, key);
	if (!res) {
		return {
			status: "loading",
      data: []
		};
	}

	return {
		status: "success",
		data: res.rows as T[],
	};
};
