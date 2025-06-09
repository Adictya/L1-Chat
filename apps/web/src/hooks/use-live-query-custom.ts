import { usePGlite } from "@electric-sql/pglite-react";
import type { LiveQuery, LiveQueryResults } from "@electric-sql/pglite/live";
import { useEffect, useRef, useState } from "react";

function paramsEqual(
	a1: unknown[] | undefined | null,
	a2: unknown[] | undefined | null,
) {
	if (!a1 && !a2) return true;
	if (a1?.length !== a2?.length) return false;
	for (let i = 0; i < a1!.length; i++) {
		if (!Object.is(a1![i], a2![i])) {
			return false;
		}
	}
	return true;
}

function fakeLiveQuery(cb: (...a: any[]) => void) {
	setTimeout(() => {
		cb();
	}, 1000);
}

export function useSimpleExample() {
	const [results, setResults] = useState<number | undefined>();

	useEffect(() => {
		const cb = () => {
			setResults(1);
		};
		fakeLiveQuery(cb);
		// setResults(1);
	}, []);

	return results;
}

export function useLiveQueryImpl2<T = { [key: string]: unknown }>(
	query: string,
	params: unknown[] | undefined | null,
): Omit<LiveQueryResults<T>, "affectedRows"> | undefined {
	const [results, setResults] = useState<LiveQueryResults<T> | undefined>();
	const pgliteDb = usePGlite();

	useEffect(() => {
		let cancelled = false;
		const cb = (results: LiveQueryResults<T>) => {
			if (cancelled) {
				return;
			}
			// console.log("results called");
			setResults(results);
		};
		const ret = pgliteDb.live.query(query, params, cb);
		ret.then((res) => {
			res.unsubscribe();
		});
		return () => {
			cancelled = true;
			ret.then((res) => {
				res.unsubscribe();
			});
		};
	}, []);

	return results;
}

export function useLiveQueryImpl<T = { [key: string]: unknown }>(
	query: string,
	params: unknown[] | undefined | null,
): Omit<LiveQueryResults<T>, "affectedRows"> | undefined {
	const db = usePGlite();
	const paramsRef = useRef(params);
	const liveQueryRef = useRef<LiveQuery<T> | undefined>(undefined);
	let liveQuery: LiveQuery<T> | undefined;
	let liveQueryChanged = false;
	if (!(typeof query === "string") && !(query instanceof Promise)) {
		liveQuery = query;
		liveQueryChanged = liveQueryRef.current !== liveQuery;
		liveQueryRef.current = liveQuery;
	}
	const [results, setResults] = useState<LiveQueryResults<T> | undefined>(
		liveQuery?.initialResults,
	);

	let currentParams = paramsRef.current;
	if (!paramsEqual(paramsRef.current, params)) {
		paramsRef.current = params;
		currentParams = params;
	}

	// Track individual dependency changes
	useEffect(() => {
		console.log("db changed:", db);
	}, [db]);

	useEffect(() => {
		console.log("key changed:", key);
	}, [key]);

	useEffect(() => {
		console.log("query changed:", query);
	}, [query]);

	useEffect(() => {
		console.log("currentParams changed:", currentParams);
	}, [currentParams]);

	useEffect(() => {
		console.log("liveQuery changed:", liveQuery);
	}, [liveQuery]);

	useEffect(() => {
		console.log("results changed", results);
	}, [results]);

	/* eslint-disable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect */
	useEffect(() => {
		let cancelled = false;
		const cb = (results: LiveQueryResults<T>) => {
			if (cancelled) return;
			setResults(results);
		};
		if (typeof query === "string") {
			const ret =
				key !== undefined
					? db.live.incrementalQuery<T>(query, currentParams, key, cb)
					: db.live.query<T>(query, currentParams, cb);

			return () => {
				cancelled = true;
				ret.then(({ unsubscribe }) => unsubscribe());
			};
		} else if (query instanceof Promise) {
			query.then((liveQuery) => {
				if (cancelled) return;
				liveQueryRef.current = liveQuery;
				setResults(liveQuery.initialResults);
				liveQuery.subscribe(cb);
			});
			return () => {
				cancelled = true;
				liveQueryRef.current?.unsubscribe(cb);
			};
		} else if (liveQuery) {
			setResults(liveQuery.initialResults);
			liveQuery.subscribe(cb);
			return () => {
				cancelled = true;
				liveQuery.unsubscribe(cb);
			};
		} else {
			throw new Error("Should never happen");
		}
	}, [db, key, query, currentParams, liveQuery]);
	/* eslint-enable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect */

	if (liveQueryChanged && liveQuery) {
		return liveQuery.initialResults;
	}

	return (
		results && {
			rows: results.rows,
			fields: results.fields,
			totalCount: results.totalCount,
			offset: results.offset,
			limit: results.limit,
		}
	);
}
