import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
	blankLine,
	FIELD_LABELS,
	FIELDS,
	type Field,
	type Line,
	linesToCsv,
	newId,
	readTable,
	type Show,
	type ShowSummary,
	type Table,
	tableToLines
} from "../../shared/lines";
import { api, useLive } from "./api";
import "./operator.scss";

// ---------------------------------------------------------------------------
// /editor – the list of shows
// ---------------------------------------------------------------------------

export function Shows() {
	const navigate = useNavigate();
	const [shows, setShows] = useState<ShowSummary[] | null>(null);
	const [error, setError] = useState("");

	const load = () =>
		api<ShowSummary[]>("/shows")
			.then(setShows)
			.catch((err: Error) => setError(err.message));
	useEffect(() => {
		load();
	}, []);

	const run = (work: Promise<unknown>) =>
		work.then(load).catch((err: Error) => setError(err.message));

	const create = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const title = String(new FormData(e.currentTarget).get("title") || "");
		api<Show>("/shows", { body: { title } })
			.then((show) => navigate(`/editor/${show.id}`))
			.catch((err: Error) => setError(err.message));
	};

	return (
		<div className="page">
			<div className="topbar">
				<Link to="/controller">← Operator</Link>
				<h1>Shows</h1>
			</div>
			<p className="muted">
				A show is one set of subtitles. Make a new one for each production, or
				duplicate an old one to start from it.
			</p>
			{error && <p className="error">{error}</p>}

			<form onSubmit={create} className="newshow">
				<input
					className="field"
					name="title"
					placeholder="Name of the new show"
					required
				/>
				<button className="btn btn--primary" type="submit">
					+ New show
				</button>
			</form>

			{shows === null && !error && <p>Loading…</p>}
			{shows?.length === 0 && <p>No shows yet – create your first one above.</p>}
			<div className="showlist">
				{shows?.map((show) => (
					<div key={show.id} className="showlist__item">
						<div className="showlist__info">
							<Link to={`/editor/${show.id}`} className="showlist__title">
								{show.title}
							</Link>
							{show.live && <span className="badge">ON DISPLAYS</span>}
							<p className="muted">
								{show.lineCount} lines · last changed{" "}
								{new Date(show.updatedAt).toLocaleString()}
							</p>
						</div>
						<div className="showlist__buttons">
							<Link className="btn btn--primary" to={`/editor/${show.id}`}>
								Edit
							</Link>
							{!show.live && (
								<button
									className="btn"
									onClick={() => {
										if (
											confirm(
												`Put "${show.title}" on the displays?\n\nEvery screen switches to its first line straight away.`
											)
										) {
											run(api("/control/load", { body: { showId: show.id } }));
										}
									}}
								>
									Put on displays
								</button>
							)}
							<button
								className="btn"
								onClick={() =>
									run(
										api("/shows", {
											body: { title: `${show.title} (copy)`, copyOf: show.id }
										})
									)
								}
							>
								Duplicate
							</button>
							<button
								className="btn btn--danger"
								disabled={show.live}
								title={
									show.live
										? "This show is on the displays. Put another show on first."
										: ""
								}
								onClick={() => {
									if (confirm(`Delete "${show.title}"?`)) {
										run(api(`/shows/${show.id}`, { method: "DELETE" }));
									}
								}}
							>
								Delete
							</button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// /editor/:showId – the spreadsheet-style editor
// ---------------------------------------------------------------------------

type RowAction = "above" | "below" | "duplicate" | "up" | "down" | "delete" | "show";

const TEXT_FIELDS: Exclude<Field, "isLyric">[] = [
	"act",
	"scene",
	"char",
	"thai",
	"eng",
	"remark"
];
const LONG_FIELDS: Field[] = ["thai", "eng", "remark"];

// A cell keeps what you type to itself and only hands it over when you leave
// the cell. That way a half-typed word never appears on the audience screens.
const Cell = ({
	id,
	field,
	value,
	onChange
}: {
	id: string;
	field: Exclude<Field, "isLyric">;
	value: string;
	onChange: (id: string, field: Field, value: string) => void;
}) => {
	const commit = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		if (e.target.value !== value) onChange(id, field, e.target.value);
	};
	if (LONG_FIELDS.includes(field)) {
		return (
			<div className="grow" data-value={value}>
				<textarea
					key={value}
					rows={1}
					data-field={field}
					aria-label={FIELD_LABELS[field]}
					defaultValue={value}
					onInput={(e) => {
						e.currentTarget.parentElement!.dataset.value = e.currentTarget.value;
					}}
					onBlur={commit}
				/>
			</div>
		);
	}
	return (
		<input
			key={value}
			data-field={field}
			aria-label={FIELD_LABELS[field]}
			defaultValue={value}
			list={field === "char" ? "characters" : undefined}
			onBlur={commit}
		/>
	);
};

const Row = memo(function Row({
	line,
	number,
	isOnScreen,
	isLive,
	onChange,
	onAction
}: {
	line: Line;
	number: number;
	isOnScreen: boolean;
	isLive: boolean;
	onChange: (id: string, field: Field, value: string | boolean) => void;
	onAction: (id: string, action: RowAction) => void;
}) {
	return (
		<div
			className={`row ${isOnScreen ? "row--onscreen" : ""}`}
			data-row={line.id}
		>
			<div className="row__number">
				{number}
				{isOnScreen && <span className="badge">NOW</span>}
			</div>
			{TEXT_FIELDS.slice(0, 5).map((field) => (
				<Cell
					key={field}
					id={line.id}
					field={field}
					value={line[field]}
					onChange={onChange}
				/>
			))}
			<label className="row__lyric" title="Tick if this line is sung">
				<input
					type="checkbox"
					checked={line.isLyric}
					onChange={(e) => onChange(line.id, "isLyric", e.target.checked)}
				/>
			</label>
			<Cell id={line.id} field="remark" value={line.remark} onChange={onChange} />
			<div className="row__actions">
				{isLive && (
					<button
						title="Show this line on the displays now"
						onClick={() => onAction(line.id, "show")}
					>
						▶
					</button>
				)}
				<button title="Add a line below" onClick={() => onAction(line.id, "below")}>
					＋
				</button>
				<button title="Add a line above" onClick={() => onAction(line.id, "above")}>
					＋↑
				</button>
				<button title="Duplicate this line" onClick={() => onAction(line.id, "duplicate")}>
					⧉
				</button>
				<button title="Move up" onClick={() => onAction(line.id, "up")}>
					↑
				</button>
				<button title="Move down" onClick={() => onAction(line.id, "down")}>
					↓
				</button>
				<button
					title="Delete this line"
					className="row__delete"
					onClick={() => onAction(line.id, "delete")}
				>
					✕
				</button>
			</div>
		</div>
	);
});

export function Editor() {
	const { showId = "" } = useParams();
	const [searchParams] = useSearchParams();
	const { live } = useLive();

	const [title, setTitle] = useState("");
	const [lines, setLines] = useState<Line[] | null>(null);
	const [status, setStatus] = useState<"saved" | "unsaved" | "saving" | "error">(
		"saved"
	);
	const [error, setError] = useState("");
	const [filter, setFilter] = useState("");
	const [importing, setImporting] = useState(false);
	const [canUndo, setCanUndo] = useState(false);

	const linesRef = useRef<Line[]>([]);
	const titleRef = useRef("");
	const history = useRef<Line[][]>([]);
	const focusNext = useRef<string | null>(null);
	const dirty = useRef(false);
	const saving = useRef(false);
	const timer = useRef<ReturnType<typeof setTimeout>>();

	const isLive = live?.showId === showId;
	const onScreenId = isLive ? live?.lines[live.index]?.id : undefined;

	// --- loading & saving ---------------------------------------------------

	useEffect(() => {
		api<Show>(`/shows/${showId}`)
			.then((show) => {
				linesRef.current = show.lines;
				titleRef.current = show.title;
				setLines(show.lines);
				setTitle(show.title);
				const line = Number(searchParams.get("line"));
				if (line > 0 && show.lines[line]) focusNext.current = show.lines[line].id;
			})
			.catch((err: Error) => setError(err.message));
	}, [showId]);

	const save = useCallback(
		async (keepalive = false) => {
			if (saving.current || !dirty.current) return;
			saving.current = true;
			dirty.current = false;
			setStatus("saving");
			try {
				await api(`/shows/${showId}`, {
					method: "PUT",
					body: { title: titleRef.current, lines: linesRef.current },
					keepalive
				});
				setStatus(dirty.current ? "unsaved" : "saved");
			} catch (err) {
				dirty.current = true;
				setStatus("error");
				setError(`Not saved – ${(err as Error).message}. Will try again.`);
				timer.current = setTimeout(() => save(), 3000);
				return;
			} finally {
				saving.current = false;
			}
			setError("");
			if (dirty.current) save();
		},
		[showId]
	);

	const scheduleSave = useCallback(() => {
		dirty.current = true;
		setStatus("unsaved");
		clearTimeout(timer.current);
		timer.current = setTimeout(() => save(), 400);
	}, [save]);

	// Warn before closing the tab if something is still being saved.
	useEffect(() => {
		const beforeUnload = (e: BeforeUnloadEvent) => {
			if (dirty.current || saving.current) {
				e.preventDefault();
				e.returnValue = "";
			}
		};
		addEventListener("beforeunload", beforeUnload);
		return () => {
			removeEventListener("beforeunload", beforeUnload);
			clearTimeout(timer.current);
			save(true); // leaving the page inside the app: save right away
		};
	}, [save]);

	// --- changing lines -----------------------------------------------------

	const change = useCallback(
		(update: (lines: Line[]) => Line[]) => {
			const before = linesRef.current;
			const after = update(before);
			if (after === before) return;
			history.current.push(before);
			if (history.current.length > 200) history.current.shift();
			linesRef.current = after;
			setLines(after);
			setCanUndo(true);
			scheduleSave();
		},
		[scheduleSave]
	);

	const undo = useCallback(() => {
		const previous = history.current.pop();
		if (!previous) return;
		linesRef.current = previous;
		setLines(previous);
		setCanUndo(history.current.length > 0);
		scheduleSave();
	}, [scheduleSave]);

	const onChange = useCallback(
		(id: string, field: Field, value: string | boolean) =>
			change((all) =>
				all.map((line) => (line.id === id ? { ...line, [field]: value } : line))
			),
		[change]
	);

	const onAction = useCallback(
		(id: string, action: RowAction) => {
			if (action === "show") {
				const index = linesRef.current.findIndex((line) => line.id === id);
				// Make sure the displays have the latest text before jumping.
				clearTimeout(timer.current);
				save().then(() => api("/control/jump", { body: { index } }));
				return;
			}
			change((all) => {
				const i = all.findIndex((line) => line.id === id);
				if (i < 0) return all;
				const next = [...all];
				const here = all[i];
				if (action === "above" || action === "below") {
					// A new line continues the same act and scene.
					const fresh = blankLine({ act: here.act, scene: here.scene });
					next.splice(action === "above" ? i : i + 1, 0, fresh);
					focusNext.current = fresh.id;
				} else if (action === "duplicate") {
					const copy = { ...here, id: newId() };
					next.splice(i + 1, 0, copy);
					focusNext.current = copy.id;
				} else if (action === "delete") {
					next.splice(i, 1);
				} else {
					const j = action === "up" ? i - 1 : i + 1;
					if (j < 0 || j >= all.length) return all;
					[next[i], next[j]] = [next[j], next[i]];
				}
				return next;
			});
		},
		[change, save]
	);

	const addAtEnd = () =>
		change((all) => {
			const last = all[all.length - 1];
			const fresh = blankLine({ act: last?.act ?? "1", scene: last?.scene ?? "1" });
			focusNext.current = fresh.id;
			return [...all, fresh];
		});

	const addQr = () =>
		change((all) => {
			const fresh = blankLine({ act: "0", scene: "0", char: "QR" });
			focusNext.current = fresh.id;
			return [fresh, ...all];
		});

	// Put the cursor in a freshly added line (or the line we were asked to open).
	useEffect(() => {
		const id = focusNext.current;
		if (!id || !lines) return;
		focusNext.current = null;
		const row = document.querySelector<HTMLElement>(`[data-row="${id}"]`);
		row?.scrollIntoView({ block: "center" });
		row?.querySelector<HTMLElement>('[data-field="char"]')?.focus();
	}, [lines]);

	// Keyboard shortcuts inside the table.
	const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		const target = e.target as HTMLElement;
		const row = target.closest<HTMLElement>("[data-row]");
		const mod = e.metaKey || e.ctrlKey;
		if (mod && e.key.toLowerCase() === "z" && !target.closest("input, textarea")) {
			e.preventDefault();
			undo();
		}
		if (!row) return;
		if (mod && e.key === "Enter") {
			e.preventDefault();
			target.blur();
			onAction(row.dataset.row!, "below");
		}
		if (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
			e.preventDefault();
			const other = (
				e.key === "ArrowDown" ? row.nextElementSibling : row.previousElementSibling
			) as HTMLElement | null;
			other
				?.querySelector<HTMLElement>(`[data-field="${target.dataset.field}"]`)
				?.focus();
		}
	};

	// --- other actions --------------------------------------------------------

	const rename = (value: string) => {
		const clean = value.trim();
		if (!clean || clean === titleRef.current) return;
		titleRef.current = clean;
		setTitle(clean);
		scheduleSave();
	};

	const exportCsv = () => {
		const blob = new Blob([linesToCsv(linesRef.current)], { type: "text/csv" });
		const link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = `${titleRef.current || "subtitles"}.csv`;
		link.click();
		URL.revokeObjectURL(link.href);
	};

	const goLive = () => {
		if (
			confirm(
				`Put "${title}" on the displays?\n\nEvery screen switches to its first line straight away.`
			)
		) {
			clearTimeout(timer.current);
			save().then(() => api("/control/load", { body: { showId } }));
		}
	};

	const characters = useMemo(
		() => Array.from(new Set((lines ?? []).map((l) => l.char).filter(Boolean))),
		[lines]
	);

	const visible = useMemo(() => {
		const all = (lines ?? []).map((line, number) => ({ line, number }));
		const query = filter.trim().toLowerCase();
		if (!query) return all;
		return all.filter(({ line, number }) =>
			[String(number), line.act, line.scene, line.char, line.thai, line.eng, line.remark]
				.join("\n")
				.toLowerCase()
				.includes(query)
		);
	}, [lines, filter]);

	if (!lines) {
		return (
			<div className="page">
				<Link to="/editor">← Shows</Link>
				<p>{error || "Loading…"}</p>
			</div>
		);
	}

	return (
		<div className="page page--wide">
			<div className="topbar">
				<Link to="/editor">← Shows</Link>
				<input
					key={title}
					className="topbar__title"
					defaultValue={title}
					aria-label="Show name"
					onBlur={(e) => rename(e.target.value)}
				/>
				<span className={`savestate savestate--${status}`}>
					{status === "saved" && "All changes saved ✓"}
					{status === "unsaved" && "Saving…"}
					{status === "saving" && "Saving…"}
					{status === "error" && "NOT SAVED"}
				</span>
			</div>

			{isLive && (
				<p className="livebanner">
					<b>This show is on the displays right now.</b> A change appears on every
					screen as soon as you leave the box you typed in.
				</p>
			)}
			{error && <p className="error">{error}</p>}

			<div className="toolbar">
				<button className="btn btn--primary" onClick={() => setImporting(true)}>
					Paste / import from spreadsheet
				</button>
				<button className="btn" onClick={addAtEnd}>
					+ Add line at end
				</button>
				<button
					className="btn"
					onClick={addQr}
					title="Adds a line that shows the audience QR code on the displays"
				>
					+ QR code slide
				</button>
				<button className="btn" onClick={undo} disabled={!canUndo}>
					↶ Undo
				</button>
				<button className="btn" onClick={exportCsv}>
					Download as CSV
				</button>
				{isLive ? (
					<Link className="btn" to="/controller">
						Go to operator
					</Link>
				) : (
					<button className="btn" onClick={goLive}>
						Put on displays
					</button>
				)}
				<input
					className="field toolbar__search"
					type="search"
					placeholder="Search lines…"
					value={filter}
					onChange={(e) => setFilter(e.target.value)}
				/>
			</div>

			<datalist id="characters">
				{characters.map((name) => (
					<option key={name} value={name} />
				))}
			</datalist>

			{lines.length === 0 ? (
				<div className="notice">
					<p>This show has no lines yet.</p>
					<p>
						The quickest way: copy the rows from Google Sheets or Excel and press{" "}
						<b>Paste / import from spreadsheet</b>. Or press{" "}
						<b>+ Add line at end</b> and type them here.
					</p>
				</div>
			) : (
				<div className="table" onKeyDown={onKeyDown}>
					<div className="row row--head">
						<div>#</div>
						{FIELDS.map((field) => (
							<div key={field}>{FIELD_LABELS[field]}</div>
						))}
						<div />
					</div>
					{visible.map(({ line, number }) => (
						<Row
							key={line.id}
							line={line}
							number={number}
							isLive={isLive}
							isOnScreen={line.id === onScreenId}
							onChange={onChange}
							onAction={onAction}
						/>
					))}
					{filter && (
						<p className="muted">
							Showing {visible.length} of {lines.length} lines.
						</p>
					)}
				</div>
			)}
			<p className="muted shortcuts">
				Tips: <b>Tab</b> moves to the next box · <b>⌘/Ctrl + Enter</b> adds a line
				below · <b>Alt + ↑/↓</b> moves between lines · a line whose Character is{" "}
				<b>QR</b> shows the audience QR code · older versions of every show are kept
				in the <code>data/backups</code> folder.
			</p>

			{importing && (
				<ImportDialog
					hasLines={lines.length > 0}
					onClose={() => setImporting(false)}
					onImport={(imported, mode) => {
						change((all) => (mode === "replace" ? imported : [...all, ...imported]));
						setImporting(false);
					}}
				/>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Paste / import dialog
// ---------------------------------------------------------------------------

function ImportDialog({
	hasLines,
	onClose,
	onImport
}: {
	hasLines: boolean;
	onClose: () => void;
	onImport: (lines: Line[], mode: "replace" | "append") => void;
}) {
	const [text, setText] = useState("");
	const [table, setTable] = useState<Table | null>(null);
	const [fillDown, setFillDown] = useState(true);
	const [mode, setMode] = useState<"replace" | "append">(
		hasLines ? "append" : "replace"
	);

	const read = (value: string) => {
		setText(value);
		setTable(value.trim() ? readTable(value) : null);
	};

	const lines = useMemo(
		() => (table ? tableToLines(table, fillDown) : []),
		[table, fillDown]
	);
	const preview = table
		? table.rows.slice(table.hasHeader ? 1 : 0, (table.hasHeader ? 1 : 0) + 5)
		: [];

	return (
		<div className="modal" onClick={onClose}>
			<div className="modal__box modal__box--wide" onClick={(e) => e.stopPropagation()}>
				<div className="modal__head">
					<h2>Paste / import from spreadsheet</h2>
					<button className="modal__close" onClick={onClose}>
						×
					</button>
				</div>
				<div className="stack">
					<p>
						<b>1.</b> In Google Sheets or Excel, select the rows and copy them. Then
						click in the box below and paste. (Or choose a .csv file.)
					</p>
					<textarea
						className="field import__box"
						placeholder="Paste here…"
						value={text}
						autoFocus
						onChange={(e) => read(e.target.value)}
					/>
					<input
						type="file"
						accept=".csv,.tsv,.txt,.json"
						onChange={(e) => e.target.files?.[0]?.text().then(read)}
					/>

					{table && (
						<>
							<p>
								<b>2.</b> Check that each column is labelled correctly.
							</p>
							<div className="import__preview">
								<table>
									<thead>
										<tr>
											{table.mapping.map((field, column) => (
												<th key={column}>
													<select
														value={field ?? ""}
														onChange={(e) => {
															const chosen = (e.target.value || null) as Field | null;
															setTable({
																...table,
																mapping: table.mapping.map((old, i) =>
																	i === column ? chosen : old === chosen ? null : old
																)
															});
														}}
													>
														<option value="">(skip)</option>
														{FIELDS.map((f) => (
															<option key={f} value={f}>
																{FIELD_LABELS[f]}
															</option>
														))}
													</select>
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{preview.map((row, r) => (
											<tr key={r}>
												{table.mapping.map((_, column) => (
													<td key={column}>{row[column]}</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
							</div>
							<label className="check">
								<input
									type="checkbox"
									checked={table.hasHeader}
									onChange={(e) => setTable({ ...table, hasHeader: e.target.checked })}
								/>
								The first row is a heading (don't import it)
							</label>
							<label className="check">
								<input
									type="checkbox"
									checked={fillDown}
									onChange={(e) => setFillDown(e.target.checked)}
								/>
								An empty Act / Scene means "same as the line above"
							</label>
							{hasLines && (
								<>
									<label className="check">
										<input
											type="radio"
											checked={mode === "append"}
											onChange={() => setMode("append")}
										/>
										Add these lines to the end of the show
									</label>
									<label className="check">
										<input
											type="radio"
											checked={mode === "replace"}
											onChange={() => setMode("replace")}
										/>
										Replace every line in the show with these (you can Undo)
									</label>
								</>
							)}
							<button
								className="btn btn--primary"
								disabled={lines.length === 0}
								onClick={() => onImport(lines, mode)}
							>
								Import {lines.length} lines
							</button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
