// A task may only be deleted while it sits in the project's "Todo" column (Manager rule).
// Column titles are user-defined; "Todo" / "To Do" (any case) is the same name the board uses for its todo status.
const isTodoColumnTitle = (title) => /^\s*to\s*-?\s*do\s*$/i.test(String(title || ''));

module.exports = { isTodoColumnTitle };
