import './app.css';

// ════════════════════════════════════════════════════════════════════
// THE BUREAU — ARCHITECTURE & DESIGN GUIDE
// ════════════════════════════════════════════════════════════════════
//
// HIGH-LEVEL FLOW:
// 1. USER OPENS A DRAWER (project, container for case files)
// 2. USER CLICKS A DRAWER → SETS AS ACTIVE (shows its case files)
// 3. USER FILES/EDITS/CLOSES CASE FILES (todos) IN THE ACTIVE DRAWER
// 4. DATA AUTOMATICALLY SAVED TO LOCALSTORAGE VIA PROXY PATTERN
// 5. ON PAGE LOAD, DATA IS RESTORED FROM STORAGE
// 6. UI RENDERS BY CALLING render() WHICH UPDATES ALL DOM ELEMENTS
//
// THE THREE STATES OF A CASE FILE:
// • FILED    — only its tab clears the folder in front. Title and a red check.
// • PEEKED   — scrolling pulls the folder up out of the stack far enough to
//              read the index strip: when it was filed, when it's due, and
//              the next objective.
// • OPENED   — clicking lifts the folder clear of the drawer and fades it
//              out; the dossier then materialises centred on screen.
//
// KEY DESIGN PATTERNS USED:
// • PROXY PATTERN: Automatically saves data when app.projects or activeProjectId changes
// • CLASS-BASED MODELS: Todo, Project, TodoApp encapsulate data & behavior
// • SEPARATION OF CONCERNS: Data logic (classes) vs. UI logic (render functions)
// • EVENT-DRIVEN UI: Button clicks trigger modal displays and data updates
// • SINGLE RENDER FUNCTION: Calling render() updates entire UI after any change
//
// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// SECTION 1: DATA MODELS (App Logic)
// ════════════════════════════════════════════════════════════════════

class Todo {
    constructor(title, description = '', dueDate = '', priority = 'medium') {
        this.id = crypto.randomUUID();
        this.title = title;
        this.description = description;
        this.dueDate = dueDate;
        this.priority = priority;
        this.completed = false;
        this.createdAt = isoToday();  // shown on the index strip as "filed"
        this.tags = [];               // string[]
        this.subtasks = [];           // { id, text, done }[]
        this.photo = null;            // base64 dataURL or null
        this.color = null;            // custom folder color, or null to fall back to priority color
        this.stamp = null;            // { dx, dy, rot, word } — where the rubber stamp landed
    }
}

// ━━━ PROJECT CLASS ━━━
// PURPOSE: A "drawer" in the cabinet — container for case files (todos).
class Project {
    constructor(name) {
        this.id = crypto.randomUUID();
        this.name = name;
        this.todos = [];
        this.color = null;        // custom lip color, or null for the default steel/paper look
    }

    addTodo(todo) {
        this.todos.push(todo);
    }

    removeTodo(todoId) {
        this.todos = this.todos.filter(todo => todo.id !== todoId);
    }

    getTodo(todoId) {
        return this.todos.find(todo => todo.id === todoId);
    }
}

// ━━━ TODOAPP CLASS - MAIN APPLICATION STATE ━━━
// PURPOSE: Central manager of all drawers and case files. Handles persistence via Proxy.
class TodoApp {
    constructor() {
        this.projects = [];
        this.activeProjectId = null;

        return new Proxy(this, {
            set: (target, prop, value) => {
                target[prop] = value;
                target.save();
                return true;
            }
        });
    }

    // Project (drawer) methods

    createProject(name) {
        const project = new Project(name);
        this.projects.push(project);
        this.activeProjectId = project.id;
        return project;
    }

    deleteProject(projectId) {
        this.projects = this.projects.filter(p => p.id !== projectId);
        if (this.activeProjectId === projectId) {
            this.activeProjectId = this.projects[0]?.id || null;
        }
    }

    // Puts a deleted drawer back exactly where it was — what the undo toast
    // calls. Splices in place rather than pushing, so the archive order the
    // user knows is preserved.
    restoreProject(project, index) {
        this.projects.splice(Math.min(index, this.projects.length), 0, project);
        this.activeProjectId = project.id;
        this.save();
    }

    renameProject(projectId, name) {
        const project = this.getProject(projectId);
        if (project) {
            project.name = name;
            this.save();
        }
    }

    setProjectColor(projectId, color) {
        const project = this.getProject(projectId);
        if (project) {
            project.color = color;
            this.save();
        }
    }

    getProject(projectId) {
        return this.projects.find(p => p.id === projectId);
    }

    setActiveProject(projectId) {
        this.activeProjectId = projectId;
    }

    getActiveProject() {
        return this.getProject(this.activeProjectId);
    }

    // Todo (case file) methods — scoped by explicit projectId so search
    // results and calendar agenda items (which may belong to a project
    // other than the active one) can still be edited/closed/deleted in place.

    addTodoToActiveProject(title, description, dueDate, priority) {
        const activeProject = this.getActiveProject();
        if (!activeProject) return;
        const todo = new Todo(title, description, dueDate, priority);
        activeProject.addTodo(todo);
        this.save();
        return todo;
    }

    deleteTodo(projectId, todoId) {
        const project = this.getProject(projectId);
        if (project) {
            project.removeTodo(todoId);
            this.save();
        }
    }

    restoreTodo(projectId, todo, index) {
        const project = this.getProject(projectId);
        if (!project) return;
        project.todos.splice(Math.min(index, project.todos.length), 0, todo);
        this.save();
    }

    updateTodo(projectId, todoId, updates) {
        const project = this.getProject(projectId);
        const todo = project?.getTodo(todoId);
        if (todo) {
            Object.assign(todo, updates);
            this.save();
        }
    }

    // Persistence

    save() {
        try {
            localStorage.setItem('todoAppData', JSON.stringify(this.projects));
        } catch (e) {
            console.error('Failed to save data:', e);
            showToast("Couldn't save — storage is full. Remove a photo or two and try again.");
        }
    }

    load() {
        const data = localStorage.getItem('todoAppData');
        if (!data) return;

        try {
            this.projects = this.hydrateProjects(JSON.parse(data));
            this.activeProjectId = this.projects[0]?.id || null;
        } catch (e) {
            console.error('Failed to load data:', e);
        }
    }

    hydrateProjects(rawProjects) {
        return rawProjects.map(p => {
            const project = new Project(p.name);
            project.id = p.id;
            project.color = p.color || null;
            project.todos = (p.todos || []).map(t => {
                const todo = new Todo(t.title, t.description, t.dueDate, t.priority);
                todo.id = t.id;
                todo.completed = !!t.completed;
                todo.createdAt = t.createdAt || '';
                todo.tags = Array.isArray(t.tags) ? t.tags : [];
                todo.subtasks = Array.isArray(t.subtasks) ? t.subtasks : [];
                todo.photo = t.photo || null;
                todo.color = t.color || null;
                todo.stamp = t.stamp || null;
                return todo;
            });
            return project;
        });
    }

    exportData() {
        return JSON.stringify({ exportedAt: new Date().toISOString(), projects: this.projects }, null, 2);
    }

    importData(jsonText) {
        const parsed = JSON.parse(jsonText);
        const rawProjects = Array.isArray(parsed) ? parsed : parsed.projects;
        if (!Array.isArray(rawProjects)) throw new Error('Invalid backup file');
        this.projects = this.hydrateProjects(rawProjects);
        this.activeProjectId = this.projects[0]?.id || null;
    }

    init() {
        this.load();
        // Seed only on a genuinely first run. Keying off projects.length
        // instead would re-seed the demo drawers every reload after someone
        // deliberately emptied their archive — deleted work coming back from
        // the dead. The presence of the saved key, not its contents, is what
        // says "this user has been here before".
        if (localStorage.getItem('todoAppData') === null) {
            seedMoreDrawers(this);
            // createProject leaves the last-seeded drawer active; the board
            // itself always opens on the first one, so line the two up
            this.activeProjectId = this.projects[0]?.id || null;
            this.save();
        }
    }
}

// ━━━ STARTER DRAWERS ━━━
// Three drawers so a fresh archive shows what a whole career of
// deferred affairs looks like.
function seedMoreDrawers(instance) {
    // Drawer: Operation New Year, Same Me — 10 case files
    instance.createProject('Operation New Year, Same Me');
    const fitness = instance.getActiveProject();
    fitness.color = '#c94422';

    const t1 = new Todo('Renew gym membership', 'Paid the annual fee. Plan: attend twice, then let the card charge in silence for eleven months.', offsetDate(-210), 'high');
    t1.createdAt = offsetDate(-212); t1.tags = ['fitness', 'resolution']; t1.color = '#1a4d70';

    const t2 = new Todo('Buy proper running shoes', '£120. Worn twice — once to the shop that sells them.', offsetDate(-205), 'medium');
    t2.createdAt = offsetDate(-206); t2.tags = ['shopping'];

    const t3 = new Todo('Watch a motivational workout video', "47 minutes admiring someone else's discipline. Zero minutes exercising your own.", offsetDate(-190), 'low');
    t3.createdAt = offsetDate(-191); t3.tags = ['research']; t3.completed = true; t3.stamp = { dx: -10, dy: 6, rot: 9, word: 'AT LAST' };

    const t4 = new Todo('Set the 6am alarm', 'Set nightly. Snoozed nightly. The alarm has stopped expecting anything.', offsetDate(1), 'medium');
    t4.createdAt = offsetDate(-180); t4.tags = ['ritual'];

    const t5 = new Todo('Buy protein powder', 'Tub #4. Tubs #1 through #3 are currently load-bearing furniture.', offsetDate(-150), 'low');
    t5.createdAt = offsetDate(-151); t5.tags = ['shopping']; t5.color = '#7a3068';

    const t6 = new Todo('Sign up for a yoga class', "Enrolled. Attended once. Told everyone you 'do yoga now.'", offsetDate(-120), 'medium');
    t6.createdAt = offsetDate(-121); t6.tags = ['resolution'];
    t6.subtasks = [
        { id: crypto.randomUUID(), text: 'Buy the mat', done: true },
        { id: crypto.randomUUID(), text: 'Attend a class', done: true },
        { id: crypto.randomUUID(), text: 'Attend a second class', done: false },
    ];

    const t7 = new Todo('Cancel the gym membership', 'The natural endpoint of item one. Full circle achieved.', offsetDate(15), 'high');
    t7.createdAt = offsetDate(-20); t7.tags = ['avoidance']; t7.color = '#c93a2e';

    const t8 = new Todo('Walk to the fridge', 'Cardio, technically. A personal best.', offsetDate(0), 'low');
    t8.createdAt = offsetDate(0); t8.completed = true; t8.stamp = { dx: 8, dy: -10, rot: -6, word: 'DONE' };

    const t9 = new Todo('Find the right step-counting app', 'Currently on app #6. Each one confirms the same number: not enough.', offsetDate(-30), 'low');
    t9.createdAt = offsetDate(-31); t9.tags = ['research'];

    const t10 = new Todo('Convince yourself tomorrow is a better day to start', 'Said every day since March. Tomorrow remains undefeated.', offsetDate(1), 'high');
    t10.createdAt = offsetDate(-160); t10.tags = ['someday'];

    [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10].forEach(todo => fitness.addTodo(todo));

    // Drawer: Operation Inbox Zero — 5 case files
    instance.createProject('Operation Inbox Zero');
    const inbox = instance.getActiveProject();
    inbox.color = '#d1962a';

    const i1 = new Todo('Unsubscribe from 200 newsletters', 'Started strong. Unsubscribed from three. Accidentally subscribed to one more.', offsetDate(-40), 'high');
    i1.createdAt = offsetDate(-41); i1.tags = ['email'];

    const i2 = new Todo('Reply to that email from HR', "Sitting there, read-but-not-answered, for a personal best duration.", offsetDate(-25), 'high');
    i2.createdAt = offsetDate(-70); i2.tags = ['avoidance']; i2.color = '#a3432a';

    const i3 = new Todo('Archive 4,000 unread emails', 'Not read. Just relocated. The math still works, technically.', offsetDate(-10), 'medium');
    i3.createdAt = offsetDate(-11); i3.tags = ['email'];

    const i4 = new Todo('Set up an out-of-office reply', 'The one email task actually completed. Currently out of office from everything.', offsetDate(-5), 'low');
    i4.createdAt = offsetDate(-6); i4.completed = true; i4.stamp = { dx: -6, dy: 8, rot: 12, word: 'HANDLED' };

    const i5 = new Todo('Turn on email notifications', "So you'll finally see them. You will not finally see them.", offsetDate(3), 'medium');
    i5.createdAt = offsetDate(-15); i5.tags = ['email'];

    [i1, i2, i3, i4, i5].forEach(todo => inbox.addTodo(todo));

    // Drawer: Operation Diet Starts Monday — 5 case files
    instance.createProject('Operation Diet Starts Monday');
    const diet = instance.getActiveProject();
    diet.color = '#1a4d70';

    const d1 = new Todo('Throw out the junk food', "Removed from the pantry. Relocated to the car, for 'emergencies.'", offsetDate(-60), 'medium');
    d1.createdAt = offsetDate(-61); d1.tags = ['diet'];

    const d2 = new Todo('Meal prep for the week', 'Bought seven containers. Filled zero. Confidence remains at seven.', offsetDate(-55), 'high');
    d2.createdAt = offsetDate(-56); d2.tags = ['diet']; d2.color = '#276b34';

    const d3 = new Todo('Buy a diet cookbook', 'Read the introduction. Deeply moved. Ordered pizza to celebrate.', offsetDate(-90), 'low');
    d3.createdAt = offsetDate(-91); d3.tags = ['research'];

    const d4 = new Todo('Find a Monday to start on', 'Twelve Mondays auditioned so far. None have been right.', offsetDate(4), 'high');
    d4.createdAt = offsetDate(-100); d4.tags = ['someday'];

    const d5 = new Todo('Google "is cereal a soup"', 'Definitive research concluded swiftly. The rest of the diet, less so.', offsetDate(0), 'low');
    d5.createdAt = offsetDate(0); d5.completed = true; d5.stamp = { dx: 10, dy: 4, rot: -10, word: 'SETTLED' };

    [d1, d2, d3, d4, d5].forEach(todo => diet.addTodo(todo));

    instance.save();
}

// ════════════════════════════════════════════════════════════════════
// SECTION 2: DOM MANIPULATION (Interface/Display)
// ════════════════════════════════════════════════════════════════════

const app = new TodoApp();

// View state (not persisted — resets on reload)
let currentView = 'list';           // 'list' | 'calendar'
let calendarCursor = new Date();
calendarCursor.setDate(1);
let selectedDayKey = null;          // 'YYYY-MM-DD'
let openDossier = null;             // { todoId, projectId } of the case file on screen
// which filed case is "pulled up" right now, per list — keyed by project id
// for board columns, or 'search'/'agenda' for those flat views
let focusState = {};
// carousel: index into app.projects of whichever drawer currently sits in
// the board's leftmost slot. Not persisted — resets on reload.
let carouselStart = 0;
let stampJustStruck = false;        // play the stamp impact on the next dossier render

// Modal scratch state for the todo being created/edited
let modalState = { tags: [], subtasks: [], photo: null, color: null };

const PRIORITY_COLOR = { high: '#c93a2e', medium: '#c1901c', low: '#1f6d92' };

const SWATCHES = [
    { name: 'brass', hex: '#c9941c' },
    { name: 'rust', hex: '#c94422' },
    { name: 'forest', hex: '#276b34' },
    { name: 'navy', hex: '#1a4d70' },
    { name: 'plum', hex: '#7a3068' },
    { name: 'mustard', hex: '#d1962a' },
    { name: 'slate', hex: '#4d5f6b' },
    { name: 'crimson', hex: '#a31f28' },
];

// Kept short on purpose: a long word rotated inside a stamp overruns the page.
const STAMP_WORDS = ['DONE', 'HANDLED', 'AT LAST', 'FINALLY', 'CLEARED', 'SETTLED'];

function pad(n) {
    return String(n).padStart(2, '0');
}

function dateKey(year, month, day) {
    return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function isoToday() {
    const d = new Date();
    return dateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

function offsetDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return dateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function tagColor(tag) {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
        hash = (hash * 31 + tag.charCodeAt(i)) | 0;
    }
    return SWATCHES[Math.abs(hash) % SWATCHES.length].hex;
}

function folderColor(todo) {
    return todo.color || PRIORITY_COLOR[todo.priority];
}

function isOverdue(todo) {
    return !!todo.dueDate && !todo.completed && todo.dueDate < isoToday();
}

// ━━━ THE RUBBER STAMP ━━━
// Each strike lands somewhere new: a random nudge off centre and a tilt
// anywhere in ±30°. The result is stored on the todo, so a stamp stays put
// once it has been applied.
function rollStamp() {
    const angle = Math.random() * Math.PI * 2;
    const distance = 10 + Math.random() * 26;
    return {
        dx: Math.round(Math.cos(angle) * distance),
        dy: Math.round(Math.sin(angle) * distance),
        rot: Math.round(Math.random() * 60 - 30),
        word: STAMP_WORDS[Math.floor(Math.random() * STAMP_WORDS.length)],
    };
}

// Shared by the folder tab and the flat agenda row — a button that flips a
// case file's completed state and re-renders.
function buildCheckButton(todo, project, className) {
    const check = document.createElement('button');
    check.type = 'button';
    check.className = className;
    check.textContent = '✓';
    check.setAttribute('aria-label', todo.completed ? `Reopen ${todo.title}` : `Close ${todo.title}`);
    check.onclick = (e) => {
        e.stopPropagation();
        toggleCompleted(todo, project);
    };
    return check;
}

function toggleCompleted(todo, project) {
    const nowComplete = !todo.completed;
    app.updateTodo(project.id, todo.id, {
        completed: nowComplete,
        stamp: nowComplete ? rollStamp() : null,
    });
    stampJustStruck = nowComplete;
    render();
}

// ━━━ FILTERS ━━━
function applyFilters(todos, { priority, status } = {}) {
    priority ??= document.getElementById('filterPriority').value;
    status ??= document.getElementById('filterStatus').value;
    return todos.filter(todo => {
        if (priority && todo.priority !== priority) return false;
        if (status === 'open' && todo.completed) return false;
        if (status === 'completed' && !todo.completed) return false;
        return true;
    });
}

// ━━━ TOASTS ━━━
// A single slot at the bottom of the screen. Destructive actions post here
// with an Undo instead of stopping the user with a confirm() — the archive
// is a scratchpad, not a bank, and a misclick shouldn't cost ten case files.
let toastTimer = null;

function showToast(message, { actionLabel, onAction, duration = 7000 } = {}) {
    const host = document.getElementById('toastHost');
    clearTimeout(toastTimer);
    host.innerHTML = '';

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');

    const text = document.createElement('span');
    text.className = 'toast-text';
    text.textContent = message;
    toast.appendChild(text);

    if (actionLabel && onAction) {
        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'toast-action';
        action.textContent = actionLabel;
        action.onclick = () => {
            dismissToast();
            onAction();
        };
        toast.appendChild(action);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-close';
    close.textContent = '✕';
    close.setAttribute('aria-label', 'Dismiss');
    close.onclick = dismissToast;
    toast.appendChild(close);

    host.appendChild(toast);
    toastTimer = setTimeout(dismissToast, duration);
}

function dismissToast() {
    clearTimeout(toastTimer);
    const host = document.getElementById('toastHost');
    const toast = host.firstElementChild;
    if (!toast) return;
    toast.classList.add('leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
}

// ━━━ THE TAB IN THE DRAWER ━━━
// Filed, a case file shows only its tab. Hovering pulls it up out of the
// stack to expose the index strip underneath the title.
function createTodoCard(todo, project, { showProjectBadge = false, index = 0, total = 1, focusKey = 'default' } = {}) {
    const li = document.createElement('li');
    li.className = 'folder' + (todo.completed ? ' completed' : '');
    li.style.setProperty('--folder', folderColor(todo));
    li.style.setProperty('--i', index);
    li.style.setProperty('--n', total);
    // later file = further forward, painted over the one behind it. Fixed at
    // build time: a card's place in the pile can't change without a re-render
    li.style.zIndex = String(index + 1);
    li.dataset.todoId = todo.id;

    // ---- the raised tab: whether the case is closed, then its codename ----
    // .file-tab is just the clipped shape (deep enough to seamlessly overlap
    // the folder's own top-left corner radius); .file-tab-inner holds the
    // actual content at the tab's original visible height, so it doesn't
    // drift down into that extra overlap depth.
    const tab = document.createElement('div');
    tab.className = 'file-tab';

    const tabInner = document.createElement('div');
    tabInner.className = 'file-tab-inner';
    tab.appendChild(tabInner);

    const check = buildCheckButton(todo, project, 'folder-check');
    tabInner.appendChild(check);

    const name = document.createElement('button');
    name.type = 'button';
    name.className = 'folder-name';
    name.textContent = todo.title;
    tabInner.appendChild(name);

    if (showProjectBadge) {
        const badge = document.createElement('span');
        badge.className = 'folder-badge';
        badge.textContent = project.name;
        tabInner.appendChild(badge);
    }

    li.appendChild(tab);

    // the folder's own coloured body — placed after the tab so it paints
    // on top of it at the seam, instead of the tab riding in front
    const card = document.createElement('div');
    card.className = 'folder-card';
    li.appendChild(card);

    // ---- index strip: only readable once the folder is pulled up ----
    const indexRow = document.createElement('dl');
    indexRow.className = 'folder-index';
    indexRow.appendChild(indexCell('Filed', formatDate(todo.createdAt)));
    indexRow.appendChild(indexCell('Due', formatDate(todo.dueDate), isOverdue(todo)));
    indexRow.appendChild(indexCell('•', `${todo.subtasks.length} subtasks`));
    li.appendChild(indexRow);

    const stencil = document.createElement('div');
    stencil.className = 'folder-stencil';
    stencil.textContent = `Case ${todo.id.slice(0, 8)} · ${todo.priority} clearance`;
    li.appendChild(stencil);

    // ---- lift it clear of the drawer, fade out, then open it centred ----
    const pullFile = () => {
        li.classList.add('ejecting');
        li.addEventListener('animationend', () => {
            openDossier = { todoId: todo.id, projectId: project.id };
            renderDossier();
        }, { once: true });
    };

    // ---- click focuses an unfocused file; clicking an already-focused
    // file opens it ----
    const focusOrOpen = () => {
        if (li.classList.contains('focused')) {
            pullFile();
            return;
        }
        const folders = [...li.parentElement.querySelectorAll('.folder')];
        const i = folders.indexOf(li);
        // in a drawer, clicking a file walks the pile until that file is the
        // one standing at the lip
        if (li.closest('.board-column')) {
            setDrawerStack(li.parentElement, focusKey, folders.length - 1 - i);
            return;
        }
        focusState[focusKey] = i;
        folders.forEach((f, j) => f.classList.toggle('focused', j === i));
        li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    // the codename button needs no handler of its own — a click on it bubbles
    // to the card and lands here anyway
    li.onclick = focusOrOpen;

    return li;
}

function indexCell(label, value, alert = false) {
    const cell = document.createElement('div');
    cell.className = 'folder-index-cell';

    const dt = document.createElement('dt');
    dt.textContent = label;

    const dd = document.createElement('dd');
    dd.textContent = value;
    if (alert) dd.classList.add('overdue');

    cell.appendChild(dt);
    cell.appendChild(dd);
    return cell;
}

// ━━━ FOCUS-BY-SCROLL ━━━
// The only way to browse a drawer is the wheel: one case file is always
// "focused" (risen straight up out of the pile, index strip readable), and
// scrolling moves that focus to the next or previous file. Everything else
// stays exactly where it already sits in the stack — natural document
// order, nothing fades, nothing reorders. Each list (a board column,
// search results, or the calendar agenda) tracks its own focused index
// independently, under its own key in focusState.
function applyFocusState(listEl, key) {
    const folders = [...listEl.querySelectorAll('.folder')];
    if (!folders.length) return;
    let idx = focusState[key] ?? 0;
    if (idx >= folders.length) idx = folders.length - 1;
    if (idx < 0) idx = 0;
    focusState[key] = idx;

    folders.forEach((folder, i) => {
        folder.classList.toggle('focused', i === idx);
    });
}

// ━━━ THE DRAWER AS A FIXED DEPTH WINDOW ━━━
// A board column's drawer never scrolls: the opening (walls, recession and
// front panel) is nailed down, and browsing re-lays the pile out *in depth*
// inside it instead. Every file sits somewhere between the lip (front) and
// the back of the recession, and the whole pile slides along that axis:
//   • scrolling up walks the pile forward — the faded files at the back come
//     closer, the frontmost ones dive under the lip and out of sight
//   • scrolling down pushes it away again, and they come back up
// stackOffset[key] is how far the pile has been walked forward, in files —
// and it is the *only* state a drawer keeps. Which file is focused isn't
// stored: it's whichever one is standing at the lip, so layoutDrawerStack
// derives it in the same pass that places everything (board columns
// therefore never appear in focusState, which is left to the flow-stacked
// search and agenda lists).
const stackOffset = {};

// how many files fit between the lip and the back of the drawer before they
// fade out entirely
const STACK_DEPTH = 6;
// perspective falloff: the smaller, the harder equal steps compress towards
// the back (see stackDepthCurve)
const STACK_K = 2.2;
// how small a file at the very back gets
const STACK_BACK_SCALE = 0.72;

// maps a normalised depth 0..1 onto 0..1 the way a receding row of equal
// objects actually projects: near steps are wide, far ones bunch up
function stackDepthCurve(p) {
    return p * (1 + STACK_K) / (p + STACK_K);
}

// the column's CSS caps it at a comfortable fixed size (see .board-column)
// so it never sprawls to fill a tall viewport — but that leaves a big empty
// gap below it on a genuinely large screen instead of using the room. This
// scales the whole drawer back up to fill whatever space the board actually
// has, capped so it doesn't grow absurd, and left alone below the point
// where the column already needs all the room it's given (mobile).
const DRAWER_ZOOM_MAX = 1.6;
const DRAWER_ZOOM_MIN_VIEWPORT = 861; // matches the .container mobile breakpoint

function updateDrawerZoom(column) {
    if (window.innerWidth < DRAWER_ZOOM_MIN_VIEWPORT) {
        column.style.zoom = '';
        return;
    }
    const board = column.closest('.board');
    if (!board) return;

    column.style.zoom = 1;
    const rect = column.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const boardStyle = getComputedStyle(board);
    const availW = board.clientWidth - parseFloat(boardStyle.paddingLeft) - parseFloat(boardStyle.paddingRight);
    const availH = board.clientHeight - parseFloat(boardStyle.paddingTop) - parseFloat(boardStyle.paddingBottom);
    const scale = Math.min(availW / rect.width, availH / rect.height, DRAWER_ZOOM_MAX);
    column.style.zoom = Math.max(1, scale).toFixed(3);
}

function layoutDrawerStack(listEl, key, folders = [...listEl.querySelectorAll('.folder')]) {
    const lip = listEl.closest('.board-column')?.querySelector('.drawer-lip');
    if (!folders.length || !lip) return;

    const cs = getComputedStyle(listEl);
    const tabH = parseFloat(cs.getPropertyValue('--tab-h'));
    const edgeH = parseFloat(cs.getPropertyValue('--edge-h'));
    const pull = parseFloat(cs.getPropertyValue('--pull'));
    const nearStep = tabH + edgeH;

    // --tab-h/--edge-h/--pull are read as their literal authored numbers —
    // custom properties don't get resolved through an ancestor's zoom the
    // way a real length property does — while the lip/list rects below are
    // real geometry, already multiplied by whatever zoom updateDrawerZoom
    // applied. Dividing that measurement back down to the same unzoomed
    // units the --vars are in keeps every quantity in this function
    // consistent; zoom re-multiplies the lot exactly once when the y values
    // computed here are written back as real translateY() lengths below.
    const zoom = parseFloat(getComputedStyle(listEl.closest('.board-column')).zoom) || 1;

    // the front slot sits one tab above the lip, so the file standing there
    // shows its tab and index strip and nothing else; the back slot is the
    // top of the recession, where the walls converge
    const frontTop = (lip.getBoundingClientRect().top - listEl.getBoundingClientRect().top) / zoom - nearStep;
    const backTop = tabH + pull;
    const span = Math.max(frontTop - backTop, 1);

    // re-clamped (and written back) rather than trusted: files can be filed
    // or deleted between renders, so an offset that was in range last time
    // may now point past the end of a shorter pile
    const n = folders.length;
    const o = Math.max(0, Math.min(n - 1, stackOffset[key] ?? 0));
    stackOffset[key] = o;

    folders.forEach((folder, i) => {
        // 0 = standing at the lip, higher = deeper into the drawer,
        // negative = already past the lip and sinking under the front panel
        const d = (n - 1 - i) - o;
        // anything past the back of the drawer parks at the back wall (and
        // has already faded out by then) instead of carrying on up and out
        const p = Math.min(Math.max(d, 0) / STACK_DEPTH, 1);
        const f = stackDepthCurve(p);

        // the one standing at the lip is pulled up a little further than its
        // slot, the way you'd tug a file halfway out to read its index strip
        const lift = d === 0 ? pull : 0;
        const y = (d >= 0 ? frontTop - span * f : frontTop - d * nearStep) - lift;
        const scale = d >= 0 ? 1 - (1 - STACK_BACK_SCALE) * f : 1;
        // the last stretch of the drawer dissolves rather than ending on a
        // hard row of tabs, matching the recession's own fade
        // fully gone by the time it reaches the back wall, so the files
        // parked there don't read as a dark clump behind the last visible one
        const opacity = d >= 0 ? Math.max(0, Math.min(1, (0.95 - p) / 0.35)) : 1;

        folder.style.transform = `translateY(${y.toFixed(1)}px) scale(${scale.toFixed(4)})`;
        folder.style.opacity = opacity.toFixed(3);
        folder.style.pointerEvents = opacity < 0.05 ? 'none' : '';
        // the file standing at the lip is the focused one, by definition
        folder.classList.toggle('focused', d === 0);
    });
}

// every drawer on the board, after a render or a resize changed the geometry
function layoutAllDrawerStacks() {
    document.querySelectorAll('.board-column').forEach(column => {
        updateDrawerZoom(column);
        const list = column.querySelector('.todos-list');
        if (list) layoutDrawerStack(list, column.dataset.projectId);
    });
}

// the depth layout is measured, not declared, so it has to be redone whenever
// the column's geometry moves under it. Coalesced into one frame: a resize
// drag fires continuously, and each pass re-measures every column.
let drawerLayoutFrame = 0;
function scheduleDrawerLayout() {
    if (drawerLayoutFrame) return;
    drawerLayoutFrame = requestAnimationFrame(() => {
        drawerLayoutFrame = 0;
        layoutAllDrawerStacks();
    });
}

// brings the file at `offset` files back from the end of the pile to the lip
function setDrawerStack(listEl, key, offset) {
    const folders = [...listEl.querySelectorAll('.folder')];
    if (!folders.length) return;
    stackOffset[key] = Math.max(0, Math.min(folders.length - 1, offset));
    layoutDrawerStack(listEl, key, folders);

    // keep the mobile slider in sync when the offset changes from anywhere
    // else (wheel, swipe, or clicking a folder directly)
    const slider = listEl.closest('.board-column')?.querySelector('.drawer-lip-slider');
    if (slider) slider.value = String(stackOffset[key]);
}

// walks a column's pile forward (+1) or back (-1) one file
function stepDrawerStack(listEl, key, delta) {
    setDrawerStack(listEl, key, (stackOffset[key] ?? 0) + delta);
}

function wireWheelFocus(el, key) {
    // No time-based cooldown (that made a continuous scroll feel like it
    // was only half-responding — see prior note). But 40 was too low in
    // the other direction: one real wheel notch is ~100-120 of deltaY, and
    // a trackpad swipe streams way more than that, so almost every gesture
    // blew past a 40px threshold several times over and fired multiple
    // focus-steps at once. ~100 means one notch ≈ one step.
    let accumulated = 0;
    const THRESHOLD = 100;

    el.addEventListener('wheel', (e) => {
        // cheap guard first: a trackpad streams dozens of events a second and
        // most of them don't clear the threshold below, so the folder list
        // isn't worth materialising until one does
        if (!el.firstElementChild) return;
        // a mostly-horizontal gesture (trackpad pan, shift+wheel) is meant
        // for the board's own horizontal scroll — let it bubble up instead
        // of hijacking it for vertical focus-by-scroll
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        e.preventDefault();

        accumulated += e.deltaY;
        if (Math.abs(accumulated) < THRESHOLD) return;

        const dir = accumulated > 0 ? 1 : -1;
        accumulated = 0;

        // a board column browses by depth instead of by focus: scrolling up
        // draws the pile forward, scrolling down sends it back
        if (el.closest('.board-column')) {
            stepDrawerStack(el, key, -dir);
            return;
        }

        const folders = [...el.querySelectorAll('.folder')];
        if (!folders.length) return;
        const idx = Math.max(0, Math.min(folders.length - 1, (focusState[key] ?? 0) + dir));
        if (idx === (focusState[key] ?? 0)) return;
        focusState[key] = idx;
        folders.forEach((f, i) => f.classList.toggle('focused', i === idx));
        folders[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, { passive: false });
}

// ━━━ THE OPENED DOSSIER ━━━
// A folder lying open on the desk, tilted, with the document clipped inside.
function renderDossier() {
    const overlay = document.getElementById('dossierOverlay');
    overlay.innerHTML = '';

    if (!openDossier) {
        overlay.hidden = true;
        return;
    }

    const project = app.getProject(openDossier.projectId);
    const todo = project?.getTodo(openDossier.todoId);
    if (!todo) {
        openDossier = null;
        overlay.hidden = true;
        return;
    }

    overlay.hidden = false;
    overlay.appendChild(buildDossier(todo, project));
    stampJustStruck = false;
}

function closeDossier() {
    openDossier = null;
    render();
}

// ━━━ KEYBOARD SHORTCUTS OVERLAY ━━━
function openShortcuts() {
    document.getElementById('shortcutsOverlay').hidden = false;
}

function closeShortcuts() {
    document.getElementById('shortcutsOverlay').hidden = true;
}

function buildDossier(todo, project) {
    const folder = document.createElement('div');
    folder.className = 'dossier-folder';
    folder.style.setProperty('--folder', folderColor(todo));
    folder.onclick = (e) => e.stopPropagation();

    // the folder's own tab, poking above the open cover
    const tab = document.createElement('div');
    tab.className = 'dossier-tab';
    tab.textContent = project.name;
    folder.appendChild(tab);

    const paper = document.createElement('div');
    paper.className = 'dossier-paper';

    if (todo.completed && todo.stamp) {
        paper.appendChild(buildStampMark(todo.stamp));
    }

    // ---- letterhead ----
    const head = document.createElement('div');
    head.className = 'dossier-head';

    const eyebrow = document.createElement('span');
    eyebrow.className = 'dossier-eyebrow';
    eyebrow.textContent = `Case ${todo.id.slice(0, 8).toUpperCase()}`;

    const clearance = document.createElement('span');
    clearance.className = `clearance-pill ${todo.priority}`;
    clearance.textContent = `${todo.priority} clearance`;

    head.appendChild(eyebrow);
    head.appendChild(clearance);
    paper.appendChild(head);

    const title = document.createElement('h2');
    title.className = 'dossier-title';
    title.textContent = todo.title;
    paper.appendChild(title);

    // ---- body: photo clipped alongside the record ----
    const body = document.createElement('div');
    body.className = 'dossier-body';

    const polaroid = document.createElement('figure');
    polaroid.className = 'polaroid';

    if (todo.photo) {
        const img = document.createElement('img');
        img.src = todo.photo;
        img.alt = `Surveillance photo for ${todo.title}`;
        polaroid.appendChild(img);
    } else {
        const blank = document.createElement('div');
        blank.className = 'polaroid-blank';
        blank.textContent = "couldn't even bother to make a photo";
        polaroid.appendChild(blank);
    }

    const caption = document.createElement('figcaption');
    caption.className = 'polaroid-caption';
    caption.textContent = todo.title;
    polaroid.appendChild(caption);

    body.appendChild(polaroid);

    const column = document.createElement('div');
    column.className = 'dossier-column';

    const rows = document.createElement('dl');
    rows.className = 'sheet-rows';
    rows.appendChild(buildRow('Filed', formatDate(todo.createdAt)));
    rows.appendChild(buildRow('Deadline', formatDate(todo.dueDate), isOverdue(todo) ? 'overdue' : ''));
    rows.appendChild(buildRow('Drawer', project.name));
    rows.appendChild(buildRow('Status', todo.completed ? 'Closed' : 'Open'));
    column.appendChild(rows);

    if (todo.tags.length) {
        const tagsRow = document.createElement('div');
        tagsRow.className = 'sheet-tags';
        todo.tags.forEach(tag => {
            const chip = document.createElement('span');
            chip.className = 'tag-chip';
            chip.style.background = tagColor(tag);
            chip.textContent = tag;
            tagsRow.appendChild(chip);
        });
        column.appendChild(tagsRow);
    }

    body.appendChild(column);
    paper.appendChild(body);

    // ---- briefing ----
    const briefLabel = document.createElement('div');
    briefLabel.className = 'sheet-label';
    briefLabel.textContent = 'Briefing';
    paper.appendChild(briefLabel);

    const brief = document.createElement('p');
    brief.className = 'sheet-body' + (todo.description ? '' : ' muted');
    brief.textContent = todo.description || 'No notes filed. The Bureau assumes you remember.';
    paper.appendChild(brief);

    // ---- objectives ----
    if (todo.subtasks.length) {
        const objLabel = document.createElement('div');
        objLabel.className = 'sheet-label';
        objLabel.textContent = 'Objectives';
        paper.appendChild(objLabel);

        const list = document.createElement('ul');
        list.className = 'sheet-objectives';
        todo.subtasks.forEach((subtask, idx) => {
            const item = document.createElement('li');
            item.className = 'sheet-objective' + (subtask.done ? ' done' : '');

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = subtask.done;
            cb.onchange = () => {
                const next = todo.subtasks.map((s, i) => (i === idx ? { ...s, done: cb.checked } : s));
                app.updateTodo(project.id, todo.id, { subtasks: next });
                render();
            };

            const text = document.createElement('span');
            text.textContent = subtask.text;

            item.appendChild(cb);
            item.appendChild(text);
            list.appendChild(item);
        });
        paper.appendChild(list);
    }

    // ---- actions ----
    const actions = document.createElement('div');
    actions.className = 'sheet-actions';

    const stampBtn = document.createElement('button');
    stampBtn.type = 'button';
    stampBtn.className = 'sheet-btn primary';
    stampBtn.textContent = todo.completed ? 'Reopen case' : 'Stamp closed';
    stampBtn.onclick = () => toggleCompleted(todo, project);

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'sheet-btn';
    editBtn.textContent = 'Amend file';
    editBtn.onclick = () => showTodoModal(todo, project.id);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'sheet-btn';
    closeBtn.textContent = 'Put back';
    closeBtn.onclick = closeDossier;

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'sheet-btn danger';
    deleteBtn.textContent = 'Shred';
    deleteBtn.onclick = () => {
        const index = project.todos.findIndex(t => t.id === todo.id);
        app.deleteTodo(project.id, todo.id);
        closeDossier();
        showToast(`Shredded "${todo.title}".`, {
            actionLabel: 'Undo',
            onAction: () => {
                app.restoreTodo(project.id, todo, index);
                render();
            },
        });
    };

    actions.appendChild(stampBtn);
    actions.appendChild(editBtn);
    actions.appendChild(closeBtn);
    actions.appendChild(deleteBtn);
    paper.appendChild(actions);

    folder.appendChild(paper);
    return folder;
}

function buildStampMark(stamp) {
    const mark = document.createElement('span');
    mark.className = 'dossier-stamp' + (stampJustStruck ? ' striking' : '');
    mark.style.setProperty('--stamp-dx', `${stamp.dx}px`);
    mark.style.setProperty('--stamp-dy', `${stamp.dy}px`);
    mark.style.setProperty('--stamp-rot', `${stamp.rot}deg`);
    mark.textContent = stamp.word;
    return mark;
}

function buildRow(label, value, valueClass = '') {
    const row = document.createElement('div');
    row.className = 'sheet-row';

    const dt = document.createElement('dt');
    dt.textContent = label;

    const dd = document.createElement('dd');
    dd.textContent = value;
    if (valueClass) dd.className = valueClass;

    row.appendChild(dt);
    row.appendChild(dd);
    return row;
}

// ━━━ RENDER THE CABINET (PROJECTS) ━━━
function renderProjects() {
    const projectsList = document.getElementById('projectsList');
    const countLabel = document.getElementById('projectCount');
    projectsList.innerHTML = '';
    countLabel.textContent = `${app.projects.length} drawer${app.projects.length !== 1 ? 's' : ''}`;

    app.projects.forEach(project => {
        const drawer = document.createElement('div');
        drawer.className = 'cab-drawer' + (project.id === app.activeProjectId ? ' active' : '');
        if (project.color) {
            drawer.style.setProperty('--cab-color', project.color);
        }

        const face = document.createElement('div');
        face.className = 'cab-face';

        const plate = document.createElement('div');
        plate.className = 'cab-plate';

        const name = document.createElement('span');
        name.className = 'cab-plate-name';
        name.textContent = project.name;
        name.dataset.initial = project.name.trim().charAt(0).toUpperCase() || '?';

        const meta = document.createElement('span');
        meta.className = 'cab-plate-meta';
        const openCount = project.todos.filter(t => !t.completed).length;
        meta.textContent = `${project.todos.length} file${project.todos.length !== 1 ? 's' : ''} · ${openCount} pending`;

        const overdueCount = project.todos.filter(isOverdue).length;
        if (overdueCount) {
            const overdue = document.createElement('span');
            overdue.className = 'cab-plate-overdue';
            overdue.textContent = `${overdueCount} overdue`;
            meta.appendChild(document.createTextNode(' · '));
            meta.appendChild(overdue);
        }

        plate.appendChild(name);
        plate.appendChild(meta);

        const handle = document.createElement('span');
        handle.className = 'cab-handle';
        handle.setAttribute('aria-hidden', 'true');

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'cab-delete';
        deleteBtn.textContent = '✕';
        deleteBtn.setAttribute('aria-label', `Delete drawer ${project.name}`);
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteDrawerWithUndo(project);
        };

        face.appendChild(plate);
        face.appendChild(handle);
        face.appendChild(deleteBtn);
        drawer.appendChild(face);

        // clicking a drawer sets it active and carousels the board to it
        // (only one drawer's column is ever rendered — see getVisibleProjects)
        drawer.onclick = () => {
            app.setActiveProject(project.id);
            renderProjects();
            updateProjectTitle();
            // only the list pane has a board to scroll — in search/calendar
            // this just switches which drawer "+ Open Case File" targets
            if (!document.getElementById('listView').hidden) {
                scrollToColumn(project.id, { animate: true });
            }
        };

        projectsList.appendChild(drawer);
    });
}

// ━━━ RENDER LIST VIEW: THE BOARD ━━━
// One drawer on screen at a time, its file stack the same vertical layout
// used elsewhere. The lip carries the drawer's name, the paging arrows and
// the add-file pull, so nothing needs to sit above the drawer itself.
// Returns the one project currently in view, honouring carouselStart.
function getVisibleProjects() {
    const total = app.projects.length;
    if (total === 0) return [];
    const start = ((carouselStart % total) + total) % total;
    return [app.projects[start]];
}

function renderBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';

    if (app.projects.length === 0) {
        board.innerHTML = '<div class="empty-state board-empty">An empty archive. Suspiciously tidy. Open a drawer.</div>';
    } else {
        getVisibleProjects().forEach(project => {
            board.appendChild(buildDrawerColumn(project));
        });
    }

    // depth layout needs the columns measured, so it can only run once
    // they're actually in the document
    layoutAllDrawerStacks();
}

// Carousels the board by one drawer. Going right, the current drawer
// rotates to the back of the archive and the next one takes its place;
// going left reverses that.
function pageBoard(direction) {
    const total = app.projects.length;
    if (total <= 1) return;
    focusDrawerIndex(((carouselStart + direction) % total + total) % total);
}

// Single entry point for "make this drawer the one on screen" — used by the
// lip arrows, the drawer-switch menu, the number-key shortcuts and the
// sidebar, so all of them keep carouselStart, the active project and the
// sidebar highlight in agreement.
function focusDrawerIndex(index) {
    if (index < 0 || index >= app.projects.length) return;
    carouselStart = index;
    app.setActiveProject(app.projects[index].id);
    renderProjects();
    renderBoard();
}

function buildDrawerColumn(project) {
    const column = document.createElement('div');
    column.className = 'board-column';
    column.dataset.projectId = project.id;

    // Vertical touch swipe walks the file stack — the touch equivalent of
    // the desktop wireWheelFocus wheel handler, since touch devices don't
    // fire 'wheel' events for a finger drag. No horizontal swipe: paging
    // between drawers on touch is the lip arrows (tap) or the drawer-switch
    // menu only, so a swipe here is never mistaken for wanting the next drawer.
    let touchStartY = 0;
    column.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });
    column.addEventListener('touchend', (e) => {
        const dy = e.changedTouches[0].clientY - touchStartY;
        // dragging a finger up (dy < 0) reads the same as scrolling down —
        // it sends the pile away, matching wireWheelFocus's sign convention
        if (Math.abs(dy) > 40) {
            stepDrawerStack(list, project.id, dy < 0 ? -1 : 1);
        }
    }, { passive: true });

    // ---- the file stack itself, scoped to this project's todos ----
    const list = document.createElement('ul');
    list.className = 'todos-list';

    const filtered = applyFilters(project.todos);
    const sorted = [...filtered].sort((a, b) => {
        if (a.completed === b.completed) return 0;
        // completed files sort first (lowest index), so they land at the
        // back of the pile instead of up front
        return a.completed ? -1 : 1;
    });

    if (sorted.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'Nothing matches. Try fewer filters, or fewer excuses.';
        list.appendChild(empty);
    } else {
        sorted.forEach((todo, i) => {
            list.appendChild(createTodoCard(todo, project, { index: i, total: sorted.length, focusKey: project.id }));
        });
        // no applyFocusState here: in a drawer the focused file isn't tracked
        // on its own, layoutDrawerStack marks whichever one ends up at the lip
    }

    wireWheelFocus(list, project.id);
    column.appendChild(list);

    // the drawer's floor: a fixed plate under the fixed file window above,
    // stamped with the drawer's name — a sibling of the list now, not
    // nested inside it, so its size never depends on the file count.
    // It also carries the paging arrows and the add-file pull, since the
    // board only ever shows one drawer at a time.
    const canPage = app.projects.length > 1;
    const lip = document.createElement('div');
    lip.className = 'drawer-lip';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'drawer-lip-arrow drawer-lip-arrow-prev';
    prevBtn.textContent = '‹';
    prevBtn.setAttribute('aria-label', 'Previous drawer');
    prevBtn.disabled = !canPage;
    prevBtn.onclick = () => pageBoard(-1);
    lip.appendChild(prevBtn);

    // wraps the label + its drawer-switch menu, centred in the lip
    const title = document.createElement('div');
    title.className = 'drawer-lip-title';

    const lipLabel = document.createElement('button');
    lipLabel.type = 'button';
    lipLabel.className = 'drawer-lip-label';
    lipLabel.setAttribute('aria-haspopup', 'true');
    lipLabel.setAttribute('aria-expanded', 'false');
    if (project.color) {
        lipLabel.style.setProperty('--drawer-lip-color', project.color);
        lipLabel.style.setProperty('--drawer-lip-name-color', project.color);
    }

    const lipLabelName = document.createElement('span');
    lipLabelName.className = 'drawer-lip-label-name';
    lipLabelName.textContent = project.name;
    lipLabel.appendChild(lipLabelName);

    const lipLabelMeta = document.createElement('span');
    lipLabelMeta.className = 'drawer-lip-label-meta';
    const openCount = project.todos.filter(t => !t.completed).length;
    lipLabelMeta.textContent = `${project.todos.length} file${project.todos.length !== 1 ? 's' : ''} · ${openCount} pending`;
    const overdueCount = project.todos.filter(isOverdue).length;
    if (overdueCount) {
        const overdue = document.createElement('span');
        overdue.className = 'drawer-lip-label-overdue';
        overdue.textContent = `${overdueCount} overdue`;
        lipLabelMeta.appendChild(document.createTextNode(' · '));
        lipLabelMeta.appendChild(overdue);
    }
    lipLabel.appendChild(lipLabelMeta);

    title.appendChild(lipLabel);

    const menu = document.createElement('div');
    menu.className = 'drawer-lip-menu';
    menu.hidden = true;

    const renameItem = document.createElement('button');
    renameItem.type = 'button';
    renameItem.className = 'drawer-lip-menu-item drawer-lip-menu-rename';
    renameItem.textContent = '✎ Rename this drawer';
    renameItem.onclick = () => {
        closeMenu();
        startRenaming();
    };
    menu.appendChild(renameItem);

    const colorRow = document.createElement('div');
    colorRow.className = 'drawer-lip-menu-colors';
    const noneSwatch = document.createElement('button');
    noneSwatch.type = 'button';
    noneSwatch.className = 'drawer-lip-swatch drawer-lip-swatch-none' + (project.color ? '' : ' selected');
    noneSwatch.setAttribute('aria-label', 'Default color');
    noneSwatch.title = 'Default';
    noneSwatch.onclick = () => {
        app.setProjectColor(project.id, null);
        renderBoard();
    };
    colorRow.appendChild(noneSwatch);
    SWATCHES.forEach(sw => {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'drawer-lip-swatch' + (project.color === sw.hex ? ' selected' : '');
        swatch.style.background = sw.hex;
        swatch.setAttribute('aria-label', sw.name);
        swatch.title = sw.name;
        swatch.onclick = () => {
            app.setProjectColor(project.id, sw.hex);
            renderBoard();
        };
        colorRow.appendChild(swatch);
    });
    menu.appendChild(colorRow);

    // Only this part scrolls: the drawer switcher can run long, but the
    // rename/color controls above it and the new-drawer/export/import
    // actions below it (mobile) should stay put rather than being scrolled
    // out of reach with it.
    const drawerList = document.createElement('div');
    drawerList.className = 'drawer-lip-menu-list';
    app.projects.forEach(p => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'drawer-lip-menu-item';
        item.textContent = p.name;
        item.setAttribute('aria-current', String(p.id === project.id));
        item.onclick = () => {
            const index = app.projects.findIndex(pr => pr.id === p.id);
            focusDrawerIndex(index);
        };
        drawerList.appendChild(item);
    });
    menu.appendChild(drawerList);

    // Mobile only (hidden on desktop via CSS): with the sidebar archive
    // gone on small screens, this menu is the only way left to create a
    // drawer or reach export/import, so it carries those actions too.
    const mobileActions = document.createElement('div');
    mobileActions.className = 'drawer-lip-menu-mobile-actions';

    const newDrawerItem = document.createElement('button');
    newDrawerItem.type = 'button';
    newDrawerItem.className = 'drawer-lip-menu-item';
    newDrawerItem.textContent = '+ New Drawer';
    newDrawerItem.onclick = () => {
        closeMenu();
        showAddProjectModal();
    };
    mobileActions.appendChild(newDrawerItem);

    const importExportRow = document.createElement('div');
    importExportRow.className = 'drawer-lip-menu-io-row';

    const exportItem = document.createElement('button');
    exportItem.type = 'button';
    exportItem.className = 'drawer-lip-menu-item';
    exportItem.textContent = 'Export';
    exportItem.onclick = () => {
        closeMenu();
        exportBackup();
    };
    importExportRow.appendChild(exportItem);

    const importItem = document.createElement('button');
    importItem.type = 'button';
    importItem.className = 'drawer-lip-menu-item';
    importItem.textContent = 'Import';
    importItem.onclick = () => {
        closeMenu();
        document.getElementById('importInput').click();
    };
    importExportRow.appendChild(importItem);

    mobileActions.appendChild(importExportRow);
    menu.appendChild(mobileActions);

    title.appendChild(menu);
    lip.appendChild(title);

    const closeMenu = () => {
        menu.hidden = true;
        lipLabel.setAttribute('aria-expanded', 'false');
        document.removeEventListener('click', onOutsideClick);
    };
    const onOutsideClick = (e) => {
        if (!lip.contains(e.target)) closeMenu();
    };
    lipLabel.onclick = (e) => {
        e.stopPropagation();
        const opening = menu.hidden;
        menu.hidden = !opening;
        lipLabel.setAttribute('aria-expanded', String(opening));
        if (opening) {
            document.addEventListener('click', onOutsideClick);
        } else {
            document.removeEventListener('click', onOutsideClick);
        }
    };

    // Swaps the label's name line for a text input, in place — commits on
    // Enter/blur, discards on Escape. Rebuilds the board either way, since
    // that's the only thing that needs to redraw.
    const startRenaming = () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'drawer-lip-rename-input';
        input.value = project.name;
        lipLabelName.replaceWith(input);
        input.focus();
        input.select();

        let settled = false;
        const commit = () => {
            if (settled) return;
            settled = true;
            const value = input.value.trim();
            if (value && value !== project.name) {
                app.renameProject(project.id, value);
                renderProjects();
            }
            renderBoard();
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            if (e.key === 'Escape') { e.preventDefault(); settled = true; renderBoard(); }
        });
    };

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'drawer-lip-arrow drawer-lip-arrow-next';
    nextBtn.textContent = '›';
    nextBtn.setAttribute('aria-label', 'Next drawer');
    nextBtn.disabled = !canPage;
    nextBtn.onclick = () => pageBoard(1);
    lip.appendChild(nextBtn);

    if (canPage) {
        const counter = document.createElement('span');
        counter.className = 'drawer-lip-counter';
        const position = app.projects.findIndex(p => p.id === project.id) + 1;
        counter.textContent = `${position} / ${app.projects.length}`;
        lip.appendChild(counter);
    }

    // purely decorative — the drawer's actual controls all live above it now
    const chrome = document.createElement('div');
    chrome.className = 'drawer-lip-chrome';
    chrome.setAttribute('aria-hidden', 'true');
    lip.appendChild(chrome);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'drawer-lip-delete';
    deleteBtn.textContent = 'Delete drawer';
    deleteBtn.setAttribute('aria-label', `Delete drawer ${project.name}`);
    deleteBtn.onclick = () => deleteDrawerWithUndo(project);
    lip.appendChild(deleteBtn);

    column.appendChild(lip);

    // Mobile only (hidden on desktop via CSS): a thumb-drag is much faster
    // than one swipe per file for walking a deep stack, so this mirrors
    // wireWheelFocus/setDrawerStack as a direct position control instead.
    const sliderRow = document.createElement('div');
    sliderRow.className = 'drawer-lip-slider-row';
    const maxOffset = Math.max(0, sorted.length - 1);
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'drawer-lip-slider';
    slider.min = '0';
    slider.max = String(maxOffset);
    slider.step = '1';
    slider.value = String(Math.min(stackOffset[project.id] ?? 0, maxOffset));
    slider.disabled = maxOffset === 0;
    slider.setAttribute('aria-label', 'Scroll through case files');
    slider.oninput = () => {
        setDrawerStack(list, project.id, Number(slider.value));
    };
    sliderRow.appendChild(slider);
    column.appendChild(sliderRow);

    return column;
}

// Shared by the lip's Delete drawer button and the sidebar's ✕. Deleting a
// whole drawer takes every case file inside it with it, so this is gated by
// a confirm() (unlike single-file deletes, which just rely on the Undo
// toast below) — the toast stays too, as a second safety net.
function deleteDrawerWithUndo(project) {
    const index = app.projects.findIndex(p => p.id === project.id);
    if (index === -1) return;

    const count = project.todos.length;
    const confirmed = window.confirm(
        `Delete "${project.name}" and its ${count} case file${count !== 1 ? 's' : ''}? This can be undone right after, but not once you leave the app.`
    );
    if (!confirmed) return;

    app.deleteProject(project.id);
    openDossier = null;
    delete stackOffset[project.id];
    const activeIndex = app.projects.findIndex(p => p.id === app.activeProjectId);
    carouselStart = activeIndex === -1 ? 0 : activeIndex;
    render();

    showToast(`Deleted "${project.name}" and its ${count} case file${count !== 1 ? 's' : ''}.`, {
        actionLabel: 'Undo',
        onAction: () => {
            app.restoreProject(project, index);
            carouselStart = index;
            render();
        },
    });
}

// Pages the carousel so a given drawer's column becomes the board's
// leftmost slot — how the sidebar list "opens" a drawer now that only
// three columns are ever rendered at once.
function scrollToColumn(projectId, { animate = false } = {}) {
    const index = app.projects.findIndex(p => p.id === projectId);
    if (index === -1) return;
    carouselStart = index;
    renderBoard();

    const col = document.querySelector(`.board-column[data-project-id="${projectId}"]`);
    if (!col) return;
    if (!animate) return;
    const list = col.querySelector('.todos-list');
    if (!list) return;
    list.classList.remove('drawer-opening');
    void list.offsetWidth; // restart the animation even if it just played
    list.classList.add('drawer-opening');
}

// ━━━ RENDER SEARCH VIEW ━━━
function renderSearch() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    const list = document.getElementById('searchResultsList');
    list.innerHTML = '';

    let results = [];
    app.projects.forEach(project => {
        project.todos.forEach(todo => {
            const haystack = [todo.title, todo.description, ...todo.tags].join(' ').toLowerCase();
            if (!query || haystack.includes(query)) {
                results.push({ todo, project });
            }
        });
    });
    const priority = document.getElementById('filterPriority').value;
    const status = document.getElementById('filterStatus').value;
    results = results.filter(({ todo }) => applyFilters([todo], { priority, status }).length > 0);

    if (results.length === 0) {
        list.innerHTML = '<div class="empty-state">No case files match. The Bureau has no record of that.</div>';
        return;
    }

    results.forEach(({ todo, project }, i) => {
        list.appendChild(createTodoCard(todo, project, {
            showProjectBadge: true,
            index: i,
            total: results.length,
            focusKey: 'search',
        }));
    });
    applyFocusState(list, 'search');

    const lip = document.createElement('div');
    lip.className = 'drawer-lip';
    lip.setAttribute('aria-hidden', 'true');
    list.appendChild(lip);
}

// ━━━ RENDER CALENDAR VIEW ━━━
function renderCalendar() {
    const label = document.getElementById('calendarLabel');
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    label.textContent = calendarCursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const byDate = {};
    app.projects.forEach(project => {
        project.todos.forEach(todo => {
            if (!todo.dueDate) return;
            (byDate[todo.dueDate] ||= []).push({ todo, project });
        });
    });

    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    const today = isoToday();

    for (let i = 0; i < totalCells; i++) {
        const dayNum = i - startOffset + 1;
        let cellDate;
        let outside = false;

        if (dayNum < 1) {
            cellDate = new Date(year, month - 1, prevMonthDays + dayNum);
            outside = true;
        } else if (dayNum > daysInMonth) {
            cellDate = new Date(year, month + 1, dayNum - daysInMonth);
            outside = true;
        } else {
            cellDate = new Date(year, month, dayNum);
        }

        const key = dateKey(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate());
        const cell = document.createElement('div');
        cell.className = 'calendar-day'
            + (outside ? ' outside' : '')
            + (key === today ? ' today' : '')
            + (key === selectedDayKey ? ' selected' : '');

        const numSpan = document.createElement('span');
        numSpan.className = 'calendar-day-num';
        numSpan.textContent = cellDate.getDate();
        cell.appendChild(numSpan);

        const items = byDate[key] || [];
        if (items.length) {
            const dots = document.createElement('div');
            dots.className = 'calendar-dots';
            items.slice(0, 6).forEach(({ todo }) => {
                const dot = document.createElement('span');
                dot.className = 'calendar-dot';
                dot.style.background = folderColor(todo);
                dots.appendChild(dot);
            });
            cell.appendChild(dots);
        }

        cell.onclick = () => {
            selectedDayKey = key;
            renderCalendar();
        };

        grid.appendChild(cell);
    }

    renderAgenda(selectedDayKey);
}

function renderAgenda(key) {
    const title = document.getElementById('agendaTitle');
    const list = document.getElementById('agendaList');
    list.innerHTML = '';

    if (!key) {
        title.textContent = 'Pick a day to see what you were going to do';
        return;
    }

    const items = [];
    app.projects.forEach(project => {
        project.todos.forEach(todo => {
            if (todo.dueDate === key) items.push({ todo, project });
        });
    });

    const [y, m, d] = key.split('-').map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    title.textContent = items.length
        ? `${items.length} case file${items.length !== 1 ? 's' : ''} due — ${label}`
        : `Nothing due — ${label}. Enjoy it.`;

    items.forEach(({ todo, project }) => {
        list.appendChild(createAgendaRow(todo, project));
    });
}

// A flat row for the calendar's agenda — no folder theatrics (no stacking,
// no tab-pull-open), just what's due and where it lives, click to open.
function createAgendaRow(todo, project) {
    const li = document.createElement('li');
    li.className = 'agenda-item' + (todo.completed ? ' completed' : '');

    li.appendChild(buildCheckButton(todo, project, 'agenda-item-check'));

    const main = document.createElement('div');
    main.className = 'agenda-item-main';

    const title = document.createElement('span');
    title.className = 'agenda-item-title';
    title.textContent = todo.title;
    main.appendChild(title);

    const meta = document.createElement('span');
    meta.className = 'agenda-item-meta';
    meta.textContent = project.name;
    main.appendChild(meta);

    li.appendChild(main);

    const priority = document.createElement('span');
    priority.className = `agenda-item-priority priority-${todo.priority}`;
    priority.textContent = todo.priority;
    li.appendChild(priority);

    li.onclick = () => {
        openDossier = { todoId: todo.id, projectId: project.id };
        renderDossier();
    };

    return li;
}

// ━━━ VIEW SWITCHING ━━━
function updateViewToggle() {
    document.getElementById('viewListBtn').classList.toggle('active', currentView === 'list');
    document.getElementById('viewCalendarBtn').classList.toggle('active', currentView === 'calendar');
}

function showPane(name) {
    document.getElementById('listView').hidden = name !== 'list';
    document.getElementById('searchView').hidden = name !== 'search';
    document.getElementById('calendarView').hidden = name !== 'calendar';
    // the board carries its own per-column header now, so the old single
    // "active drawer" header only makes sense for the flat search/calendar views
    document.getElementById('contentHeader').hidden = name === 'list';
}

// the content-header's title only shows above the flat search/calendar
// views now (the board carries its own per-column titles instead)
function updateProjectTitle() {
    const project = app.getActiveProject();
    document.getElementById('projectTitle').textContent =
        project ? project.name : (app.projects.length ? 'Select a drawer' : 'No drawers');
}

// ━━━ MASTER RENDER FUNCTION ━━━
function render() {
    renderProjects();
    updateProjectTitle();

    const searchInput = document.getElementById('searchInput');
    // derived here rather than in the input handler, so the button also
    // disappears when something else clears the field programmatically
    document.getElementById('searchClearBtn').hidden = searchInput.value.length === 0;

    const searching = searchInput.value.trim().length > 0;
    if (searching) {
        showPane('search');
        renderSearch();
    } else if (currentView === 'calendar') {
        showPane('calendar');
        renderCalendar();
    } else {
        showPane('list');
        renderBoard();
    }

    renderDossier();
}

// ━━━ IMAGE HANDLING ━━━
// Downscales an attached photo client-side before it's stored as a base64
// dataURL in localStorage, keeping the archive from bloating past the quota.
function resizeImageFile(file, maxDim = 420) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = () => {
            const img = new Image();
            img.onerror = reject;
            img.onload = () => {
                let { width, height } = img;
                if (width > height && width > maxDim) {
                    height = Math.round(height * (maxDim / width));
                    width = maxDim;
                } else if (height >= width && height > maxDim) {
                    width = Math.round(width * (maxDim / height));
                    height = maxDim;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.82));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

// ━━━ MODAL: NEW DRAWER ━━━
function showAddProjectModal() {
    const modal = document.getElementById('projectModal');
    const input = document.getElementById('projectModalInput');
    const createBtn = document.getElementById('projectModalCreateBtn');
    const closeBtn = document.getElementById('projectModalCloseBtn');

    input.value = '';
    input.focus();

    createBtn.onclick = () => {
        const name = input.value.trim();
        if (name) {
            const project = app.createProject(name);
            document.getElementById('searchInput').value = '';
            currentView = 'list';
            openDossier = null;
            updateViewToggle();
            render();
            scrollToColumn(project.id, { animate: true });
            modal.style.display = 'none';
        }
    };

    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    input.onkeypress = (e) => {
        if (e.key === 'Enter') createBtn.onclick();
    };

    modal.style.display = 'flex';
}

// ━━━ MODAL: TODO SCRATCH-STATE RENDERERS ━━━
function renderModalTags() {
    const list = document.getElementById('modalTagList');
    list.innerHTML = '';
    modalState.tags.forEach((tag, idx) => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip';
        chip.style.background = tagColor(tag);
        chip.textContent = tag;

        const rm = document.createElement('button');
        rm.type = 'button';
        rm.textContent = '✕';
        rm.setAttribute('aria-label', `Remove tag ${tag}`);
        rm.onclick = () => {
            modalState.tags.splice(idx, 1);
            renderModalTags();
        };
        chip.appendChild(rm);
        list.appendChild(chip);
    });
}

function renderModalSubtasks() {
    const list = document.getElementById('modalSubtaskList');
    list.innerHTML = '';
    modalState.subtasks.forEach((subtask, idx) => {
        const li = document.createElement('li');
        li.className = 'subtask-item' + (subtask.done ? ' done' : '');

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = subtask.done;
        cb.onchange = () => {
            subtask.done = cb.checked;
            renderModalSubtasks();
        };

        const span = document.createElement('span');
        span.textContent = subtask.text;

        const rm = document.createElement('button');
        rm.type = 'button';
        rm.textContent = '✕';
        rm.setAttribute('aria-label', `Remove objective ${subtask.text}`);
        rm.onclick = () => {
            modalState.subtasks.splice(idx, 1);
            renderModalSubtasks();
        };

        li.appendChild(cb);
        li.appendChild(span);
        li.appendChild(rm);
        list.appendChild(li);
    });
}

function renderModalPhoto() {
    const img = document.getElementById('modalPhotoPreview');
    const placeholder = document.getElementById('modalPhotoPlaceholder');
    const removeBtn = document.getElementById('modalPhotoRemoveBtn');

    if (modalState.photo) {
        img.src = modalState.photo;
        img.hidden = false;
        placeholder.hidden = true;
        removeBtn.hidden = false;
    } else {
        img.hidden = true;
        img.removeAttribute('src');
        placeholder.hidden = false;
        removeBtn.hidden = true;
    }
}

function renderModalColorSwatches() {
    const row = document.getElementById('modalColorSwatches');
    row.innerHTML = '';

    SWATCHES.forEach(sw => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'color-swatch' + (modalState.color === sw.hex ? ' selected' : '');
        btn.style.background = sw.hex;
        btn.title = sw.name;
        btn.setAttribute('aria-label', `Folder color ${sw.name}`);
        btn.onclick = () => {
            modalState.color = modalState.color === sw.hex ? null : sw.hex;
            renderModalColorSwatches();
        };
        row.appendChild(btn);
    });

    const custom = document.createElement('input');
    custom.type = 'color';
    custom.className = 'color-swatch-custom';
    custom.title = 'Custom color';
    custom.value = modalState.color || '#93712f';
    custom.oninput = (e) => {
        modalState.color = e.target.value;
        renderModalColorSwatches();
    };
    row.appendChild(custom);
}

function resetModalState() {
    modalState = { tags: [], subtasks: [], photo: null, color: null };
}

function refreshModalPanels() {
    renderModalTags();
    renderModalSubtasks();
    renderModalPhoto();
    renderModalColorSwatches();
}

function closeTodoModal() {
    document.getElementById('todoModal').style.display = 'none';
}

// ━━━ MODAL: ADD CASE FILE ━━━
function showAddTodoModal() {
    const project = app.getActiveProject();
    if (!project) {
        showToast('Open a drawer first. Case files need somewhere to be ignored.', {
            actionLabel: 'New drawer',
            onAction: showAddProjectModal,
        });
        return;
    }

    resetModalState();

    document.getElementById('modalTitle').value = '';
    document.getElementById('modalDescription').value = '';
    document.getElementById('modalDueDate').value = '';
    document.getElementById('modalPriority').value = 'medium';
    document.getElementById('modalTagInput').value = '';
    document.getElementById('modalSubtaskInput').value = '';
    refreshModalPanels();

    document.getElementById('todoModalTitle').textContent = 'Open Case File';
    const updateBtn = document.getElementById('modalUpdateBtn');
    updateBtn.textContent = 'File It';

    updateBtn.onclick = () => {
        const title = document.getElementById('modalTitle').value.trim();
        if (!title) return;

        const todo = app.addTodoToActiveProject(
            title,
            document.getElementById('modalDescription').value,
            document.getElementById('modalDueDate').value,
            document.getElementById('modalPriority').value
        );
        app.updateTodo(project.id, todo.id, {
            tags: [...modalState.tags],
            subtasks: modalState.subtasks.map(s => ({ ...s })),
            photo: modalState.photo,
            color: modalState.color,
        });

        document.getElementById('searchInput').value = '';
        currentView = 'list';
        updateViewToggle();
        render();
        closeTodoModal();
    };

    document.getElementById('todoModal').style.display = 'flex';
}

// ━━━ MODAL: EDIT CASE FILE ━━━
function showTodoModal(todo, projectId) {
    modalState = {
        tags: [...todo.tags],
        subtasks: todo.subtasks.map(s => ({ ...s })),
        photo: todo.photo || null,
        color: todo.color || null,
    };

    document.getElementById('modalTitle').value = todo.title;
    document.getElementById('modalDescription').value = todo.description;
    document.getElementById('modalDueDate').value = todo.dueDate;
    document.getElementById('modalPriority').value = todo.priority;
    document.getElementById('modalTagInput').value = '';
    document.getElementById('modalSubtaskInput').value = '';
    refreshModalPanels();

    document.getElementById('todoModalTitle').textContent = 'Amend Case File';
    const updateBtn = document.getElementById('modalUpdateBtn');
    updateBtn.textContent = 'Update';

    updateBtn.onclick = () => {
        const title = document.getElementById('modalTitle').value.trim();
        if (!title) return;
        app.updateTodo(projectId, todo.id, {
            title,
            description: document.getElementById('modalDescription').value,
            dueDate: document.getElementById('modalDueDate').value,
            priority: document.getElementById('modalPriority').value,
            tags: [...modalState.tags],
            subtasks: modalState.subtasks.map(s => ({ ...s })),
            photo: modalState.photo,
            color: modalState.color,
        });
        render();
        closeTodoModal();
    };

    document.getElementById('todoModal').style.display = 'flex';
}

// ━━━ EXPORT / IMPORT ━━━
function exportBackup() {
    const data = app.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bureau-case-files-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function importBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
        // Snapshotted before the swap so the whole import is undoable —
        // better than a confirm() gate, since the archive it replaces is
        // recoverable either way.
        const snapshot = app.exportData();
        try {
            app.importData(reader.result);
        } catch (e) {
            console.error('Failed to import backup:', e);
            showToast('That file could not be read as a valid Bureau backup.');
            return;
        }
        resetViewStateAfterImport();

        const count = app.projects.length;
        showToast(`Imported ${count} drawer${count !== 1 ? 's' : ''}, replacing the previous archive.`, {
            actionLabel: 'Undo',
            onAction: () => {
                app.importData(snapshot);
                resetViewStateAfterImport();
            },
        });
    };
    reader.readAsText(file);
}

// Every per-drawer bit of view state is keyed by project id, and an import
// swaps in a whole new set of ids — so it all has to be dropped.
function resetViewStateAfterImport() {
    openDossier = null;
    focusState = {};
    Object.keys(stackOffset).forEach(k => delete stackOffset[k]);
    carouselStart = 0;
    render();
}

// ════════════════════════════════════════════════════════════════════
// SECTION 3: STARTUP & EVENT LISTENERS
// ════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    app.init();
    updateViewToggle();
    render();

    // Focus-by-scroll: wheel over the search list moves the focused case
    // instead of scrolling past it (see applyFocusState/wireWheelFocus).
    // The agenda list is intentionally flat (createAgendaRow) and has no
    // stacking to focus. Board columns are wired individually as they're
    // built (renderBoard).
    wireWheelFocus(document.getElementById('searchResultsList'), 'search');

    // a drawer's depth layout is measured from the lip's position, so it goes
    // stale the moment the column is resized — catches sidebar collapses and
    // view switches too, not just window resizes
    new ResizeObserver(scheduleDrawerLayout).observe(document.getElementById('board'));

    // Drawers & case files
    document.getElementById('newProjectBtn').onclick = showAddProjectModal;
    document.getElementById('newTodoBtn').onclick = showAddTodoModal;
    document.getElementById('boardAddFileBtn').onclick = () => {
        const [project] = getVisibleProjects();
        if (project) app.setActiveProject(project.id);
        showAddTodoModal();
    };

    // View toggle
    document.getElementById('viewListBtn').onclick = () => {
        currentView = 'list';
        updateViewToggle();
        render();
    };
    document.getElementById('viewCalendarBtn').onclick = () => {
        currentView = 'calendar';
        updateViewToggle();
        render();
    };

    // Search & filters
    const searchInput = document.getElementById('searchInput');
    searchInput.oninput = () => { render(); };
    document.getElementById('searchClearBtn').onclick = () => {
        searchInput.value = '';
        render();
        searchInput.focus();
    };
    document.getElementById('filterPriority').onchange = () => { render(); };
    document.getElementById('filterStatus').onchange = () => { render(); };

    // Calendar navigation
    document.getElementById('calendarPrevBtn').onclick = () => {
        calendarCursor.setMonth(calendarCursor.getMonth() - 1);
        renderCalendar();
    };
    document.getElementById('calendarNextBtn').onclick = () => {
        calendarCursor.setMonth(calendarCursor.getMonth() + 1);
        renderCalendar();
    };

    // Export / import
    document.getElementById('exportBtn').onclick = exportBackup;
    document.getElementById('importBtn').onclick = () => document.getElementById('importInput').click();
    document.getElementById('importInput').onchange = (e) => {
        const file = e.target.files[0];
        if (file) importBackup(file);
        e.target.value = '';
    };

    // Dossier overlay: click the desk around it, or press Escape, to put it back
    document.getElementById('dossierOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'dossierOverlay') closeDossier();
    });
    document.addEventListener('keydown', (e) => {
        const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
        const modalOpen = document.getElementById('todoModal').style.display === 'flex'
            || document.getElementById('projectModal').style.display === 'flex';
        const shortcutsOpen = !document.getElementById('shortcutsOverlay').hidden;

        if (e.key === 'Escape') {
            if (shortcutsOpen) return closeShortcuts();
            if (document.getElementById('todoModal').style.display === 'flex') return closeTodoModal();
            if (document.getElementById('projectModal').style.display === 'flex') {
                document.getElementById('projectModal').style.display = 'none';
                return;
            }
            if (openDossier) return closeDossier();
            if (document.activeElement === document.getElementById('searchInput')) {
                document.getElementById('searchInput').blur();
            }
            return;
        }

        // Everything below is a bare-key shortcut, so none of it may fire
        // while the user is typing or has something layered over the board.
        if (typing || modalOpen || openDossier) return;

        if (e.key === '?') {
            e.preventDefault();
            return shortcutsOpen ? closeShortcuts() : openShortcuts();
        }
        if (shortcutsOpen) return;

        if (e.key === '/') {
            e.preventDefault();
            return document.getElementById('searchInput').focus();
        }
        if (e.key === 'n' || e.key === 'N') {
            e.preventDefault();
            const [project] = getVisibleProjects();
            if (project) app.setActiveProject(project.id);
            return showAddTodoModal();
        }
        if (e.key === 'd' || e.key === 'D') {
            e.preventDefault();
            return showAddProjectModal();
        }

        // Left/right paging, and 1-9 jumping straight to a drawer — only
        // meaningful on the board itself, so skipped in the other views.
        const isPagingKey = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
        const isJumpKey = /^[1-9]$/.test(e.key);
        if (isPagingKey || isJumpKey) {
            const searching = document.getElementById('searchInput').value.trim().length > 0;
            if (currentView !== 'list' || searching) return;
            if (isPagingKey) pageBoard(e.key === 'ArrowLeft' ? -1 : 1);
            else focusDrawerIndex(Number(e.key) - 1);
        }
    });

    // Keyboard shortcuts overlay
    document.getElementById('shortcutsOpenBtn').onclick = openShortcuts;
    document.getElementById('shortcutsCloseBtn').onclick = closeShortcuts;
    document.getElementById('shortcutsOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'shortcutsOverlay') closeShortcuts();
    });

    // Todo modal: tags
    document.getElementById('modalTagInput').addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const val = e.target.value.trim();
        if (val && !modalState.tags.includes(val)) {
            modalState.tags.push(val);
            renderModalTags();
        }
        e.target.value = '';
    });

    // Todo modal: subtasks
    const addSubtaskFromInput = () => {
        const input = document.getElementById('modalSubtaskInput');
        const val = input.value.trim();
        if (!val) return;
        modalState.subtasks.push({ id: crypto.randomUUID(), text: val, done: false });
        input.value = '';
        renderModalSubtasks();
    };
    document.getElementById('modalSubtaskAddBtn').onclick = addSubtaskFromInput;
    document.getElementById('modalSubtaskInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addSubtaskFromInput();
        }
    });

    // Todo modal: photo
    document.getElementById('modalPhotoUploadBtn').onclick = () => document.getElementById('modalPhotoInput').click();
    document.getElementById('modalPhotoInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            modalState.photo = await resizeImageFile(file);
            renderModalPhoto();
        } catch (err) {
            console.error('Failed to read image:', err);
            showToast('That image could not be attached.');
        }
        e.target.value = '';
    });
    document.getElementById('modalPhotoRemoveBtn').onclick = () => {
        modalState.photo = null;
        renderModalPhoto();
    };

    // Todo modal: close
    document.getElementById('modalClose').onclick = closeTodoModal;
    document.getElementById('todoModal').addEventListener('click', (e) => {
        if (e.target.id === 'todoModal') closeTodoModal();
    });

    // Project modal: close on outside click
    document.getElementById('projectModal').addEventListener('click', (e) => {
        if (e.target.id === 'projectModal') {
            e.target.style.display = 'none';
        }
    });
});
