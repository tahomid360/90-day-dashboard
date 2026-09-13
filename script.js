const DEFAULT_TARGETS = { study: 420, skill: 60, english: 30, research: 30, care: 60 };
const SALAH_LIST = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

const RANKS = [
    { minPct: 100, name: "👑 90-Day Master" },
    { minPct: 90, name: "🏆 Top Performer" },
    { minPct: 75, name: "💪 Elite" },
    { minPct: 60, name: "🔥 Consistent" },
    { minPct: 40, name: "⚡ Disciplined" },
    { minPct: 20, name: "📖 Starter" },
    { minPct: 0, name: "🌱 Beginner" }
];

const LEVEL_XP = [0, 500, 1000, 1500, 2200, 3000, 4000, 5000, 6500, 8000, 10000];

const ACHIEVEMENTS_LIST = [
    { id: 'day1', icon: '🌱', title: 'First Step', desc: 'Complete Day 1' },
    { id: 'streak3', icon: '🔥', title: 'Momentum', desc: 'Reach a 3-Day Streak' },
    { id: 'streak7', icon: '🔥', title: 'Bronze Streak', desc: 'Reach a 7-Day Streak' },
    { id: 'streak14', icon: '⚡', title: 'Silver Streak', desc: 'Reach a 14-Day Streak' },
    { id: 'streak30', icon: '🏆', title: 'Gold Streak', desc: 'Reach a 30-Day Streak' },
    { id: 'study10', icon: '📚', title: 'Scholar I', desc: 'Log 10 Study Hours' },
    { id: 'skill10', icon: '💻', title: 'Craftsman', desc: 'Log 10 Skill Dev Hours' },
    { id: 'salah50', icon: '🕌', title: 'Devoted I', desc: 'Perform 50 Salahs' }
];

let appState = {
    theme: 'dark',
    startDate: new Date().toISOString().slice(0, 10),
    targets: { ...DEFAULT_TARGETS },
    streak: 0,
    longestStreak: 0,
    history: {},
    unlockedBadges: []
};

let timerInterval = null;
let activeTimerTask = null;

document.addEventListener('DOMContentLoaded', () => {
    loadState();
    checkDateRollover();
    setupNavigation();
    setupEventListeners();
    renderAll();
});

function loadState() {
    const saved = localStorage.getItem('90day_forge_state');
    if (saved) {
        try { appState = JSON.parse(saved); } catch (e) {}
    }
    document.documentElement.setAttribute('data-theme', appState.theme || 'dark');
}

function saveState() {
    localStorage.setItem('90day_forge_state', JSON.stringify(appState));
    renderAll();
}

function getTodayKey() { return new Date().toISOString().slice(0, 10); }

function getDayNumber(dateStr) {
    const start = new Date(appState.startDate);
    const curr = new Date(dateStr);
    const diffDays = Math.floor((curr - start) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, Math.min(90, diffDays));
}

function checkDateRollover() {
    const today = getTodayKey();
    if (!appState.history[today]) {
        appState.history[today] = {
            dayNum: getDayNumber(today),
            tasks: { study: 0, skill: 0, english: 0, research: 0, care: 0 },
            salah: [],
            notes: ""
        };
        updateStreaks();
        saveState();
    }
}

function calculateDayMetrics(dayKey) {
    const record = appState.history[dayKey];
    if (!record) return { pct: 0, xp: 0 };

    const t = appState.targets;
    const tasks = record.tasks || {};

    const studyPct = Math.min(1, (tasks.study || 0) / t.study);
    const skillPct = Math.min(1, (tasks.skill || 0) / t.skill);
    const engPct = Math.min(1, (tasks.english || 0) / t.english);
    const resPct = Math.min(1, (tasks.research || 0) / t.research);
    const carePct = Math.min(1, (tasks.care || 0) / t.care);
    const salahPct = ((record.salah || []).length) / 5;

    const totalPct = Math.round(((studyPct + skillPct + engPct + resPct + carePct + salahPct) / 6) * 100);

    let xp = 0;
    xp += Math.floor((tasks.study || 0) / 30) * 50;
    xp += Math.floor((tasks.skill || 0) / 30) * 40;
    xp += Math.floor((tasks.english || 0) / 30) * 40;
    xp += Math.floor((tasks.research || 0) / 30) * 40;
    xp += Math.floor((tasks.care || 0) / 30) * 30;
    xp += (record.salah || []).length * 20;

    if (totalPct >= 70) xp += 80;
    if (totalPct >= 100) xp += 150;

    return { pct: totalPct, xp: xp };
}

function getTotalXP() {
    let total = 0;
    Object.keys(appState.history).forEach(key => { total += calculateDayMetrics(key).xp; });
    return total;
}

function getOverallCompletionPct() {
    const keys = Object.keys(appState.history);
    if (keys.length === 0) return 0;
    let sumPct = 0;
    keys.forEach(k => { sumPct += calculateDayMetrics(k).pct; });
    return (sumPct / 90).toFixed(1);
}

function getRank(pct) {
    for (let r of RANKS) { if (pct >= r.minPct) return r.name; }
    return RANKS[RANKS.length - 1].name;
}

function getLevelInfo(totalXP) {
    let lvl = 1;
    for (let i = 0; i < LEVEL_XP.length; i++) {
        if (totalXP >= LEVEL_XP[i]) lvl = i + 1;
        else break;
    }
    const currentLvlXP = LEVEL_XP[lvl - 1] || 0;
    const nextLvlXP = LEVEL_XP[lvl] || (currentLvlXP + 3000);
    const progress = Math.min(100, Math.round(((totalXP - currentLvlXP) / (nextLvlXP - currentLvlXP)) * 100));
    return { level: lvl, nextLvlXP, progress };
}

function updateStreaks() {
    const dates = Object.keys(appState.history).sort();
    let currentStreak = 0, maxStreak = 0;
    for (let d of dates) {
        if (calculateDayMetrics(d).pct >= 70) {
            currentStreak++;
            if (currentStreak > maxStreak) maxStreak = currentStreak;
        } else { currentStreak = 0; }
    }
    appState.streak = currentStreak;
    appState.longestStreak = maxStreak;
}

function renderAll() {
    updateStreaks();
    checkAchievements();
    renderDashboard();
    renderTasks();
    renderSalah();
    renderCalendar();
    renderAnalytics();
    renderAchievements();
}

function renderDashboard() {
    const todayKey = getTodayKey();
    const todayMetrics = calculateDayMetrics(todayKey);
    const dayNum = getDayNumber(todayKey);
    const totalXP = getTotalXP();
    const overallPct = getOverallCompletionPct();
    const lvlInfo = getLevelInfo(totalXP);

    document.getElementById('dash-day-title').innerText = `Day ${dayNum} / 90`;
    document.getElementById('dash-rank').innerText = getRank(todayMetrics.pct);
    document.getElementById('dash-streak').innerText = `🔥 ${appState.streak} Day Streak`;

    document.getElementById('dash-today-pct').innerText = `${todayMetrics.pct}%`;
    document.getElementById('dash-today-bar').style.width = `${todayMetrics.pct}%`;
    document.getElementById('dash-today-xp').innerText = `+${todayMetrics.xp} XP Earned Today`;

    document.getElementById('dash-level').innerText = `Lvl ${lvlInfo.level}`;
    document.getElementById('dash-level-bar').style.width = `${lvlInfo.progress}%`;
    document.getElementById('dash-level-xp').innerText = `${totalXP} / ${lvlInfo.nextLvlXP} XP`;

    document.getElementById('dash-overall-pct').innerText = `${overallPct}%`;
    document.getElementById('dash-overall-bar').style.width = `${Math.min(100, overallPct)}%`;
    document.getElementById('dash-days-left').innerText = `${Math.max(0, 90 - dayNum)} Days Remaining`;

    const todayRecord = appState.history[todayKey] || { salah: [], notes: "" };
    const salahCount = (todayRecord.salah || []).length;
    document.getElementById('dash-salah-pct').innerText = `${salahCount}/5`;
    document.getElementById('dash-salah-bar').style.width = `${(salahCount / 5) * 100}%`;
    document.getElementById('daily-notes').value = todayRecord.notes || "";
}

function renderTasks() {
    const container = document.getElementById('tasks-container');
    container.innerHTML = '';
    const todayKey = getTodayKey();
    const tasks = appState.history[todayKey].tasks;

    const taskDefs = [
        { id: 'study', title: 'Study', target: appState.targets.study },
        { id: 'skill', title: 'Skill Development', target: appState.targets.skill },
        { id: 'english', title: 'English Learning', target: appState.targets.english },
        { id: 'research', title: 'Research Learning', target: appState.targets.research },
        { id: 'care', title: 'Hair/Skin/Jawline Care', target: appState.targets.care }
    ];

    taskDefs.forEach(task => {
        const completed = tasks[task.id] || 0;
        const pct = Math.min(100, Math.round((completed / task.target) * 100));
        const isTimerRunning = activeTimerTask === task.id;

        const card = document.createElement('div');
        card.className = 'card task-card';
        card.innerHTML = `
            <div class="task-header">
                <span class="task-title">${task.title}</span>
                <span class="task-time">${completed} / ${task.target} mins (${pct}%)</span>
            </div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${pct}%"></div></div>
            <div class="task-actions">
                <button class="btn ${isTimerRunning ? 'btn-danger' : 'btn-primary'} btn-sm" onclick="toggleTimer('${task.id}')">
                    ${isTimerRunning ? '⏸ Stop Timer' : '▶ Start Timer'}
                </button>
                <button class="btn btn-secondary btn-sm" onclick="addMinutes('${task.id}', 15)">+15m</button>
                <button class="btn btn-secondary btn-sm" onclick="addMinutes('${task.id}', 30)">+30m</button>
                <button class="btn btn-secondary btn-sm" onclick="addMinutes('${task.id}', 60)">+60m</button>
                <button class="btn btn-success btn-sm" onclick="completeTask('${task.id}', ${task.target})">✓ Full</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderSalah() {
    const container = document.getElementById('salah-container');
    container.innerHTML = '';
    const todayKey = getTodayKey();
    const completedSalahs = appState.history[todayKey].salah || [];

    SALAH_LIST.forEach(salah => {
        const isDone = completedSalahs.includes(salah);
        const item = document.createElement('div');
        item.className = `salah-item ${isDone ? 'completed' : ''}`;
        item.innerHTML = `<h4>${salah}</h4><span>${isDone ? '✓ Prayed' : '☐ Pending'}</span>`;
        item.onclick = () => toggleSalah(salah);
        container.appendChild(item);
    });
    document.getElementById('salah-score-text').innerText = `${completedSalahs.length} / 5 Completed`;
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    for (let i = 1; i <= 90; i++) {
        const dayDate = new Date(appState.startDate);
        dayDate.setDate(dayDate.getDate() + (i - 1));
        const dateKey = dayDate.toISOString().slice(0, 10);
        const metrics = appState.history[dateKey] ? calculateDayMetrics(dateKey) : { pct: 0, xp: 0 };
        
        let colorClass = 'c-0';
        if (metrics.pct >= 90) colorClass = 'c-90';
        else if (metrics.pct >= 75) colorClass = 'c-75';
        else if (metrics.pct >= 50) colorClass = 'c-50';
        else if (metrics.pct >= 25) colorClass = 'c-25';

        const box = document.createElement('div');
        box.className = `day-box ${colorClass}`;
        box.innerHTML = `<span class="day-num">Day ${i}</span><span class="day-pct">${metrics.pct}%</span>`;
        box.onclick = () => showDayModal(i, dateKey, metrics);
        grid.appendChild(box);
    }
}

function renderAnalytics() {
    let totals = { study: 0, skill: 0, english: 0, research: 0, care: 0, salah: 0 };
    Object.keys(appState.history).forEach(k => {
        const rec = appState.history[k];
        const t = rec.tasks || {};
        totals.study += t.study || 0;
        totals.skill += t.skill || 0;
        totals.english += t.english || 0;
        totals.research += t.research || 0;
        totals.care += t.care || 0;
        totals.salah += (rec.salah || []).length;
    });

    document.getElementById('an-study-hrs').innerText = `${(totals.study / 60).toFixed(1)} hrs`;
    document.getElementById('an-skill-hrs').innerText = `${(totals.skill / 60).toFixed(1)} hrs`;
    document.getElementById('an-eng-mins').innerText = `${totals.english} mins`;
    document.getElementById('an-res-mins').innerText = `${totals.research} mins`;
    document.getElementById('an-care-mins').innerText = `${totals.care} mins`;
    document.getElementById('an-salah-total').innerText = `${totals.salah} / 450`;
    document.getElementById('an-total-xp').innerText = `${getTotalXP()} XP`;
    document.getElementById('an-longest-streak').innerText = `${appState.longestStreak} Days`;
    document.getElementById('an-avg-score').innerText = `${getOverallCompletionPct()}%`;
}

function renderAchievements() {
    const container = document.getElementById('achievements-container');
    container.innerHTML = '';
    let count = 0;
    ACHIEVEMENTS_LIST.forEach(badge => {
        const unlocked = appState.unlockedBadges.includes(badge.id);
        if (unlocked) count++;
        const card = document.createElement('div');
        card.className = `card achievement-card ${unlocked ? 'unlocked' : ''}`;
        card.innerHTML = `
            <div class="achievement-icon">${badge.icon}</div>
            <div>
                <h4>${badge.title}</h4>
                <p class="subtitle">${badge.desc}</p>
                <span style="font-size: 11px; color: ${unlocked ? 'var(--accent-green)' : 'var(--text-secondary)'}">
                    ${unlocked ? '✓ Unlocked' : '🔒 Locked'}
                </span>
            </div>
        `;
        container.appendChild(card);
    });
    document.getElementById('badge-count-text').innerText = `${count} / ${ACHIEVEMENTS_LIST.length} Unlocked`;
}

function addMinutes(taskId, mins) {
    const todayKey = getTodayKey();
    appState.history[todayKey].tasks[taskId] = (appState.history[todayKey].tasks[taskId] || 0) + mins;
    saveState();
    showToast(`+${mins} mins logged! 🔥`);
}

function completeTask(taskId, targetMins) {
    const todayKey = getTodayKey();
    appState.history[todayKey].tasks[taskId] = targetMins;
    saveState();
    showToast(`Task Completed! 🎉`);
}

function toggleSalah(salahName) {
    const todayKey = getTodayKey();
    let list = appState.history[todayKey].salah || [];
    if (list.includes(salahName)) { list = list.filter(s => s !== salahName); }
    else { list.push(salahName); showToast(`Salah ${salahName} marked! 🕌`); }
    appState.history[todayKey].salah = list;
    saveState();
}

function toggleTimer(taskId) {
    if (activeTimerTask === taskId) {
        clearInterval(timerInterval);
        activeTimerTask = null;
        document.getElementById('active-timer-display').style.display = 'none';
        showToast(`Timer stopped.`);
    } else {
        if (timerInterval) clearInterval(timerInterval);
        activeTimerTask = taskId;
        let seconds = 0;
        document.getElementById('active-timer-display').style.display = 'inline-block';
        timerInterval = setInterval(() => {
            seconds++;
            const m = Math.floor(seconds / 60), s = seconds % 60;
            document.getElementById('active-timer-display').innerText = `⏱️ Tracking ${taskId}: ${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            if (seconds % 60 === 0) addMinutes(taskId, 1);
        }, 1000);
        showToast(`Timer started!`);
    }
    renderTasks();
}

function checkAchievements() {
    const streak = appState.streak;
    let totalStudy = 0, totalSkill = 0, totalSalah = 0;

    Object.keys(appState.history).forEach(k => {
        const rec = appState.history[k];
        const t = rec.tasks || {};
        totalStudy += t.study || 0;
        totalSkill += t.skill || 0;
        totalSalah += (rec.salah || []).length;
    });

    const unlock = (id) => {
        if (!appState.unlockedBadges.includes(id)) {
            appState.unlockedBadges.push(id);
            showToast(`🏆 Badge Unlocked!`);
        }
    };

    if (Object.keys(appState.history).length >= 1) unlock('day1');
    if (streak >= 3) unlock('streak3');
    if (streak >= 7) unlock('streak7');
    if (streak >= 14) unlock('streak14');
    if (streak >= 30) unlock('streak30');
    if (totalStudy >= 600) unlock('study10');
    if (totalSkill >= 600) unlock('skill10');
    if (totalSalah >= 50) unlock('salah50');
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 2500);
}

function showDayModal(dayNum, dateKey, metrics) {
    const modal = document.getElementById('day-modal');
    const rec = appState.history[dateKey] || { tasks: {}, salah: [], notes: "" };
    const t = rec.tasks || {};

    document.getElementById('modal-day-title').innerText = `Day ${dayNum} Summary (${dateKey})`;
    document.getElementById('modal-day-body').innerHTML = `
        <p><strong>Overall Completion:</strong> ${metrics.pct}%</p>
        <p><strong>XP Earned:</strong> ${metrics.xp} XP</p>
        <hr style="margin: 10px 0; border-color: var(--border-color)">
        <p>📚 <strong>Study:</strong> ${t.study || 0} mins</p>
        <p>💻 <strong>Skill Dev:</strong> ${t.skill || 0} mins</p>
        <p>🇬🇧 <strong>English:</strong> ${t.english || 0} mins</p>
        <p>🔬 <strong>Research:</strong> ${t.research || 0} mins</p>
        <p>💆 <strong>Self-Care:</strong> ${t.care || 0} mins</p>
        <p>🕌 <strong>Salah:</strong> ${(rec.salah || []).length} / 5</p>
        <hr style="margin: 10px 0; border-color: var(--border-color)">
        <p><strong>Notes:</strong> ${rec.notes || 'No notes written.'}</p>
    `;
    modal.style.display = 'flex';
}

function setupNavigation() {
    const buttons = document.querySelectorAll('.nav-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        });
    });
}

function setupEventListeners() {
    document.getElementById('theme-toggle').addEventListener('click', () => {
        appState.theme = appState.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', appState.theme);
        saveState();
    });

    document.getElementById('save-notes-btn').addEventListener('click', () => {
        appState.history[getTodayKey()].notes = document.getElementById('daily-notes').value;
        saveState();
        showToast('Notes saved!');
    });

    document.getElementById('save-targets-btn').addEventListener('click', () => {
        appState.targets.study = parseInt(document.getElementById('target-study').value) || 420;
        appState.targets.skill = parseInt(document.getElementById('target-skill').value) || 60;
        appState.targets.english = parseInt(document.getElementById('target-english').value) || 30;
        appState.targets.research = parseInt(document.getElementById('target-research').value) || 30;
        appState.targets.care = parseInt(document.getElementById('target-care').value) || 60;
        saveState();
        showToast('Targets updated!');
    });

    document.querySelector('.close-modal').onclick = () => { document.getElementById('day-modal').style.display = 'none'; };

    document.getElementById('export-btn').addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute("href", dataStr);
        dlAnchor.setAttribute("download", `90Day_Backup_${getTodayKey()}.json`);
        document.body.appendChild(dlAnchor);
        dlAnchor.click();
        dlAnchor.remove();
    });

    document.getElementById('import-trigger-btn').onclick = () => document.getElementById('import-file').click();
    
    document.getElementById('import-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                appState = JSON.parse(event.target.result);
                saveState();
                showToast('Backup restored!');
            } catch (err) { alert('Invalid JSON file.'); }
        };
        reader.readAsText(file);
    });

    document.getElementById('reset-today-btn').addEventListener('click', () => {
        if (confirm("আজকের সব প্রোগ্রেস রিসেট করতে চাও?")) {
            const todayKey = getTodayKey();
            appState.history[todayKey].tasks = { study: 0, skill: 0, english: 0, research: 0, care: 0 };
            appState.history[todayKey].salah = [];
            saveState();
            showToast("Today's progress reset.");
        }
    });

    document.getElementById('reset-all-btn').addEventListener('click', () => {
        if (confirm("🚨 সাবধান: সব ৯০ দিনের ডাটা মুছে ফেলতে চাও?")) {
            localStorage.removeItem('90day_forge_state');
            location.reload();
        }
    });
}