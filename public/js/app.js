// Meeting Scheduler Client Application Logic

document.addEventListener('DOMContentLoaded', () => {
  // App State
  let activePollId = null;
  let activePollData = null;
  let selectedVotes = {}; // { [option_id]: 'yes' | 'maybe' | 'no' }

  // Viewer Time Zone State
  const defaultLocalTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  let activeTimeZone = localStorage.getItem('meeting_scheduler_tz') || defaultLocalTz;

  // DOM Elements
  const navBtns = document.querySelectorAll('.nav-btn');
  const viewSections = document.querySelectorAll('.view-section');
  const brandLogo = document.getElementById('brandLogo');
  const mainNavTabs = document.getElementById('mainNavTabs');
  const navCreateBtn = document.getElementById('navCreateBtn');
  const navListBtn = document.getElementById('navListBtn');
  const guestNavBadge = document.getElementById('guestNavBadge');
  const userTimeZoneSelect = document.getElementById('userTimeZoneSelect');
  const creatorTimeZoneSelect = document.getElementById('creatorTimeZoneSelect');
  const detailTimezoneDisplay = document.getElementById('detailTimezoneDisplay');

  let isGuestMode = false;

  // Form Elements
  const createPollForm = document.getElementById('createPollForm');
  const slotsContainer = document.getElementById('slotsContainer');
  const addSlotBtn = document.getElementById('addSlotBtn');
  const preset1Btn = document.getElementById('preset1Btn');
  const preset2Btn = document.getElementById('preset2Btn');
  const preset3Btn = document.getElementById('preset3Btn');

  // List View Elements
  const pollsListContainer = document.getElementById('pollsListContainer');
  const refreshPollsBtn = document.getElementById('refreshPollsBtn');

  // Detail & Dashboard Elements
  const noPollSelected = document.getElementById('noPollSelected');
  const pollDetailContent = document.getElementById('pollDetailContent');
  const gotoCreateBtn = document.getElementById('gotoCreateBtn');

  const pollStatusBadge = document.getElementById('pollStatusBadge');
  const detailTitle = document.getElementById('detailTitle');
  const detailDescription = document.getElementById('detailDescription');
  const detailOrganizer = document.getElementById('detailOrganizer');
  const detailLocation = document.getElementById('detailLocation');

  // Voting Elements
  const voteForm = document.getElementById('voteForm');
  const guestNameInput = document.getElementById('guestName');
  const voteSlotsContainer = document.getElementById('voteSlotsContainer');

  // Aggregation & Dashboard Elements
  const topConsensusCard = document.getElementById('topConsensusCard');
  const topSlotLabel = document.getElementById('topSlotLabel');
  const topSlotStats = document.getElementById('topSlotStats');
  const totalParticipantsCount = document.getElementById('totalParticipantsCount');
  const resultsBreakdownContainer = document.getElementById('resultsBreakdownContainer');
  const matrixHeaderRow = document.getElementById('matrixHeaderRow');
  const matrixTableBody = document.getElementById('matrixTableBody');
  const finalizePollBtn = document.getElementById('finalizePollBtn');
  const deletePollBtn = document.getElementById('deletePollBtn');
  const shareLinkInput = document.getElementById('shareLinkInput');
  const copyShareLinkBtn = document.getElementById('copyShareLinkBtn');

  // Toast Container
  const toastContainer = document.getElementById('toastContainer');

  // -------------------------------------------------------------
  // Time Zone Handling & Dropdown Setup
  // -------------------------------------------------------------
  const timezoneList = [
    { value: defaultLocalTz, label: `Local (${defaultLocalTz})` },
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    { value: 'America/New_York', label: 'US/Eastern (New York)' },
    { value: 'America/Chicago', label: 'US/Central (Chicago)' },
    { value: 'America/Denver', label: 'US/Mountain (Denver)' },
    { value: 'America/Los_Angeles', label: 'US/Pacific (Los Angeles)' },
    { value: 'Europe/London', label: 'UK/London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
    { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
    { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
    { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
    { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
    { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST)' },
    { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZST)' }
  ];

  function populateTimeZoneDropdown(selectElement, selectedValue) {
    if (!selectElement) return;
    selectElement.innerHTML = '';
    const seen = new Set();
    timezoneList.forEach(tz => {
      if (!seen.has(tz.value)) {
        seen.add(tz.value);
        const opt = document.createElement('option');
        opt.value = tz.value;
        opt.textContent = tz.label;
        if (tz.value === selectedValue) opt.selected = true;
        selectElement.appendChild(opt);
      }
    });
  }

  populateTimeZoneDropdown(userTimeZoneSelect, activeTimeZone);
  populateTimeZoneDropdown(creatorTimeZoneSelect, activeTimeZone);

  if (userTimeZoneSelect) {
    userTimeZoneSelect.addEventListener('change', () => {
      activeTimeZone = userTimeZoneSelect.value;
      localStorage.setItem('meeting_scheduler_tz', activeTimeZone);
      if (activePollData && activePollId) {
        loadPollDetail(activePollId);
      }
    });
  }

  function getTimeZoneShortCode(dateObj, tz) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short', timeZone: tz }).formatToParts(dateObj);
      const tzPart = parts.find(p => p.type === 'timeZoneName');
      return tzPart ? tzPart.value : tz;
    } catch (e) {
      return tz;
    }
  }

  function parseDateTimeInTimeZone(dateStr, timeStr, timeZone) {
    if (!dateStr || !timeStr) return new Date();
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, minute] = timeStr.split(':').map(Number);

    let dateGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));

    for (let i = 0; i < 3; i++) {
      const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: timeZone || activeTimeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      const parts = dtf.formatToParts(dateGuess);
      const p = {};
      parts.forEach(pt => p[pt.type] = pt.value);

      let formattedHour = parseInt(p.hour, 10);
      if (formattedHour === 24) formattedHour = 0;

      const formattedDate = new Date(Date.UTC(
        parseInt(p.year, 10),
        parseInt(p.month, 10) - 1,
        parseInt(p.day, 10),
        formattedHour,
        parseInt(p.minute, 10)
      ));

      const targetLocalMillis = Date.UTC(year, month - 1, day, hour, minute);
      const diff = targetLocalMillis - formattedDate.getTime();

      if (diff === 0) break;
      dateGuess = new Date(dateGuess.getTime() + diff);
    }

    return dateGuess;
  }

  function formatSlotTime(startTimeStr, endTimeStr, timeZone) {
    if (!startTimeStr) return 'Unspecified Time';
    const tz = timeZone || activeTimeZone;

    let startDate = new Date(startTimeStr);
    let endDate = endTimeStr ? new Date(endTimeStr) : null;

    if (isNaN(startDate.getTime())) {
      return startTimeStr + (endTimeStr ? ' - ' + endTimeStr : '');
    }

    try {
      const dateStr = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: tz
      }).format(startDate);

      const startTimeFormatted = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: tz
      }).format(startDate);

      let endTimeFormatted = '';
      if (endDate && !isNaN(endDate.getTime())) {
        endTimeFormatted = new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: tz
        }).format(endDate);
      }

      const tzCode = getTimeZoneShortCode(startDate, tz);
      const timeRange = endTimeFormatted ? `${startTimeFormatted} – ${endTimeFormatted}` : startTimeFormatted;

      return `${dateStr} • ${timeRange} ${tzCode}`;
    } catch (err) {
      return startTimeStr + (endTimeStr ? ' - ' + endTimeStr : '');
    }
  }

  // -------------------------------------------------------------
  // Navigation, Routing & View Switching
  // -------------------------------------------------------------
  function slugify(text) {
    if (!text) return 'meeting';
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '') || 'meeting';
  }

  function setGuestMode(enabled) {
    isGuestMode = !!enabled;
    if (isGuestMode) {
      if (navCreateBtn) navCreateBtn.classList.add('hidden');
      if (navListBtn) navListBtn.classList.add('hidden');
      if (guestNavBadge) guestNavBadge.classList.remove('hidden');
    } else {
      if (navCreateBtn) navCreateBtn.classList.remove('hidden');
      if (navListBtn) navListBtn.classList.remove('hidden');
      if (guestNavBadge) guestNavBadge.classList.add('hidden');
    }
  }

  function switchView(targetViewId, updateHistory = true) {
    if (isGuestMode && targetViewId !== 'detailView') {
      showToast('Invitees are restricted to viewing their invited poll.', 'info');
      targetViewId = 'detailView';
    }

    navBtns.forEach(btn => {
      if (btn.getAttribute('data-target') === targetViewId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    viewSections.forEach(section => {
      if (section.id === targetViewId) {
        section.classList.add('active-view');
      } else {
        section.classList.remove('active-view');
      }
    });

    if (targetViewId === 'listView') {
      fetchPollsList();
      if (updateHistory) history.pushState(null, '', '/polls');
    } else if (targetViewId === 'createView') {
      if (updateHistory) history.pushState(null, '', '/');
    } else if (targetViewId === 'detailView' && activePollId) {
      if (updateHistory && activePollData) {
        const titleSlug = slugify(activePollData.poll.title);
        history.pushState(null, '', `/poll/${activePollId}/${titleSlug}`);
      }
    }
  }

  function handleURLRoute() {
    const path = window.location.pathname;
    const hash = window.location.hash;

    // Match /poll/:id or /poll/:id/:slug or #poll/:id
    const pathMatch = path.match(/^\/poll\/([a-zA-Z0-9-]+)/);
    const hashMatch = hash.match(/^#poll\/([a-zA-Z0-9-]+)/);

    const pollId = pathMatch ? pathMatch[1] : (hashMatch ? hashMatch[1] : null);

    if (pollId) {
      setGuestMode(true);
      activePollId = pollId;
      loadPollDetail(pollId);
      switchView('detailView', false);
    } else if (path === '/polls' || hash === '#polls') {
      setGuestMode(false);
      switchView('listView', false);
    } else {
      setGuestMode(false);
      switchView('createView', false);
    }
  }

  window.addEventListener('popstate', handleURLRoute);

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      switchView(target);
    });
  });

  brandLogo.addEventListener('click', () => {
    setGuestMode(false);
    switchView('createView');
  });
  gotoCreateBtn.addEventListener('click', () => switchView('createView'));

  if (copyShareLinkBtn && shareLinkInput) {
    copyShareLinkBtn.addEventListener('click', () => {
      if (!shareLinkInput.value) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareLinkInput.value)
          .then(() => showToast('Shareable invite link copied to clipboard!', 'success'))
          .catch(() => fallbackCopy());
      } else {
        fallbackCopy();
      }
    });
  }

  function fallbackCopy() {
    shareLinkInput.select();
    document.execCommand('copy');
    showToast('Shareable invite link copied to clipboard!', 'success');
  }

  // -------------------------------------------------------------
  // Time Slot Management in Create Form
  // -------------------------------------------------------------
  function addSlotInputRow(defaultDate = '', defaultStart = '10:00', defaultEnd = '11:00') {
    const slotId = 'slot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const row = document.createElement('div');
    row.className = 'slot-item';
    row.id = slotId;

    row.innerHTML = `
      <div class="slot-inputs">
        <div>
          <label>Date</label>
          <input type="date" class="slot-date" value="${defaultDate}" required>
        </div>
        <div>
          <label>Start Time</label>
          <input type="time" class="slot-start" value="${defaultStart}" required>
        </div>
        <div>
          <label>End Time</label>
          <input type="time" class="slot-end" value="${defaultEnd}" required>
        </div>
      </div>
      <button type="button" class="btn-icon-danger remove-slot-btn" title="Remove Slot">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    `;

    slotsContainer.appendChild(row);

    row.querySelector('.remove-slot-btn').addEventListener('click', () => {
      if (slotsContainer.children.length <= 1) {
        showToast('At least one time slot is required.', 'error');
        return;
      }
      row.remove();
    });
  }

  // Initialize with 3 slots by default
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = tomorrow.toISOString().split('T')[0];

  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);
  const dayAfterIso = dayAfter.toISOString().split('T')[0];

  addSlotInputRow(tomorrowIso, '10:00', '11:00');
  addSlotInputRow(tomorrowIso, '14:00', '15:00');
  addSlotInputRow(dayAfterIso, '11:00', '12:00');

  addSlotBtn.addEventListener('click', () => {
    addSlotInputRow(tomorrowIso, '09:00', '10:00');
  });

  preset1Btn.addEventListener('click', () => addSlotInputRow(tomorrowIso, '10:00', '11:00'));
  preset2Btn.addEventListener('click', () => addSlotInputRow(tomorrowIso, '14:00', '15:00'));
  preset3Btn.addEventListener('click', () => addSlotInputRow(dayAfterIso, '11:00', '12:00'));

  // -------------------------------------------------------------
  // Create Poll API Request
  // -------------------------------------------------------------
  createPollForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('pollTitle').value.trim();
    const description = document.getElementById('pollDescription').value.trim();
    const organizer_name = document.getElementById('organizerName').value.trim();
    const location = document.getElementById('pollLocation').value.trim();

    const creatorTz = creatorTimeZoneSelect ? creatorTimeZoneSelect.value : activeTimeZone;
    const slotElements = slotsContainer.querySelectorAll('.slot-item');
    const options = [];

    slotElements.forEach(item => {
      const dateVal = item.querySelector('.slot-date').value;
      const startVal = item.querySelector('.slot-start').value;
      const endVal = item.querySelector('.slot-end').value;

      if (dateVal && startVal && endVal) {
        // Construct date object in creator's selected timezone
        const startDateObj = parseDateTimeInTimeZone(dateVal, startVal, creatorTz);
        const endDateObj = parseDateTimeInTimeZone(dateVal, endVal, creatorTz);

        const start_time = !isNaN(startDateObj.getTime()) ? startDateObj.toISOString() : `${dateVal}T${startVal}:00`;
        const end_time = !isNaN(endDateObj.getTime()) ? endDateObj.toISOString() : `${dateVal}T${endVal}:00`;
        const slot_label = formatSlotTime(start_time, end_time, activeTimeZone);

        options.push({
          start_time,
          end_time,
          slot_label
        });
      }
    });

    if (options.length === 0) {
      showToast('Please specify at least one valid time slot.', 'error');
      return;
    }

    try {
      const response = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, organizer_name, location, options })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create poll.');
      }

      showToast('Poll created successfully!', 'success');
      activePollId = data.poll.id;
      
      // Clear form inputs
      createPollForm.reset();
      
      // Load active poll in detail view
      loadPollDetail(activePollId);
      switchView('detailView');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // -------------------------------------------------------------
  // List View: Fetch & Render All Polls
  // -------------------------------------------------------------
  async function fetchPollsList() {
    try {
      pollsListContainer.innerHTML = '<p class="text-muted">Loading polls...</p>';
      const res = await fetch('/api/polls');
      const polls = await res.json();

      if (!Array.isArray(polls) || polls.length === 0) {
        pollsListContainer.innerHTML = '<p class="text-muted">No polls created yet. Click "Create Poll" to get started.</p>';
        return;
      }

      pollsListContainer.innerHTML = '';
      polls.forEach(poll => {
        const card = document.createElement('div');
        card.className = 'poll-card';
        card.innerHTML = `
          <div class="poll-card-header-row">
            <div class="poll-card-title">${escapeHtml(poll.title)}</div>
            <button type="button" class="poll-card-delete-btn" title="Delete Poll">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
          <div class="poll-card-meta">
            <span><i class="fa-solid fa-user"></i> ${escapeHtml(poll.organizer_name)}</span>
            <span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(poll.location || 'N/A')}</span>
            <span><i class="fa-solid fa-clock"></i> ${new Date(poll.created_at).toLocaleString()}</span>
          </div>
        `;

        const cardDeleteBtn = card.querySelector('.poll-card-delete-btn');
        if (cardDeleteBtn) {
          cardDeleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deletePoll(poll.id, poll.title);
          });
        }

        card.addEventListener('click', () => {
          activePollId = poll.id;
          loadPollDetail(activePollId);
          switchView('detailView');
        });
        pollsListContainer.appendChild(card);
      });
    } catch (err) {
      pollsListContainer.innerHTML = '<p class="required">Error loading polls.</p>';
    }
  }

  refreshPollsBtn.addEventListener('click', fetchPollsList);

  // -------------------------------------------------------------
  // Poll Detail & Dashboard Rendering
  // -------------------------------------------------------------
  async function loadPollDetail(pollId) {
    if (!pollId) return;

    try {
      const res = await fetch(`/api/polls/${pollId}`);
      if (!res.ok) throw new Error('Poll not found');
      
      const data = await res.json();
      activePollData = data;

      noPollSelected.classList.add('hidden');
      pollDetailContent.classList.remove('hidden');

      // Populate Overview Banner
      detailTitle.textContent = data.poll.title;
      detailDescription.textContent = data.poll.description || 'No additional agenda provided.';
      detailOrganizer.textContent = data.poll.organizer_name;
      detailLocation.textContent = data.poll.location || 'Remote / Online';
      if (detailTimezoneDisplay) {
        detailTimezoneDisplay.textContent = `${getTimeZoneShortCode(new Date(), activeTimeZone)} (${activeTimeZone})`;
      }

      if (data.poll.status === 'finalized') {
        pollStatusBadge.textContent = 'Finalized';
        pollStatusBadge.className = 'badge badge-finalized';
      } else {
        pollStatusBadge.textContent = 'Active Poll';
        pollStatusBadge.className = 'badge badge-active';
      }

      // Update Shareable Invite Link Input & Address Bar URL with poll title slug
      const titleSlug = slugify(data.poll.title);
      const shareUrl = `${window.location.origin}/poll/${pollId}/${titleSlug}`;
      if (shareLinkInput) {
        shareLinkInput.value = shareUrl;
      }
      if (!window.location.pathname.startsWith(`/poll/${pollId}`)) {
        history.pushState(null, '', `/poll/${pollId}/${titleSlug}`);
      }

      // Render Guest Voting Choices Form
      renderVotingForm(data.options);

      // Render Results Breakdown & Consensus Dashboard
      renderResultsDashboard(data);

    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // -------------------------------------------------------------
  // Render Voting Form Rows
  // -------------------------------------------------------------
  function renderVotingForm(options) {
    voteSlotsContainer.innerHTML = '';
    selectedVotes = {};

    options.forEach(opt => {
      // Default choice is 'yes' for easy submission
      selectedVotes[opt.option_id] = 'yes';

      const formattedLabel = formatSlotTime(opt.start_time, opt.end_time, activeTimeZone);

      const row = document.createElement('div');
      row.className = 'vote-slot-row';
      row.setAttribute('data-option-id', opt.option_id);

      row.innerHTML = `
        <div class="slot-label-text">
          <i class="fa-solid fa-calendar-day accent-icon"></i>
          <span>${escapeHtml(formattedLabel)}</span>
        </div>
        <div class="availability-options">
          <button type="button" class="choice-btn selected" data-choice="yes">
            <i class="fa-solid fa-circle-check"></i> Yes
          </button>
          <button type="button" class="choice-btn" data-choice="maybe">
            <i class="fa-solid fa-circle-question"></i> Maybe
          </button>
          <button type="button" class="choice-btn" data-choice="no">
            <i class="fa-solid fa-circle-xmark"></i> No
          </button>
        </div>
      `;

      const choiceBtns = row.querySelectorAll('.choice-btn');
      choiceBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          choiceBtns.forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          const choice = btn.getAttribute('data-choice');
          selectedVotes[opt.option_id] = choice;
        });
      });

      voteSlotsContainer.appendChild(row);
    });
  }

  // -------------------------------------------------------------
  // Submit Guest Availability Vote
  // -------------------------------------------------------------
  voteForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const guest_name = guestNameInput.value.trim();
    if (!guest_name) {
      showToast('Please enter your name.', 'error');
      return;
    }

    if (!activePollId) {
      showToast('No active poll loaded.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/polls/${activePollId}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_name, votes: selectedVotes })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit response.');

      showToast(`Thank you ${guest_name}! Your response has been recorded.`, 'success');
      guestNameInput.value = '';

      // Refresh poll detail & dashboard
      loadPollDetail(activePollId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // -------------------------------------------------------------
  // Render Results Breakdown & Consensus Dashboard
  // -------------------------------------------------------------
  function renderResultsDashboard(data) {
    const { options, guestResponses, guestMatrix } = data;
    const totalParticipants = guestResponses.length;
    totalParticipantsCount.textContent = `Total Participants: ${totalParticipants}`;

    // 1. Identify Top Consensus Slot
    let topOption = null;
    let maxYes = -1;

    options.forEach(opt => {
      const yesCount = opt.yes_count || 0;
      if (yesCount > maxYes) {
        maxYes = yesCount;
        topOption = opt;
      }
    });

    if (topOption && totalParticipants > 0) {
      topSlotLabel.textContent = formatSlotTime(topOption.start_time, topOption.end_time, activeTimeZone);
      topSlotStats.textContent = `${topOption.yes_count} Yes vote(s) out of ${totalParticipants} participant(s)`;
    } else {
      topSlotLabel.textContent = 'Awaiting initial responses';
      topSlotStats.textContent = 'No votes cast yet';
    }

    // 2. Render Aggregated Breakdown Progress Bars
    resultsBreakdownContainer.innerHTML = '';
    options.forEach(opt => {
      const yes = opt.yes_count || 0;
      const maybe = opt.maybe_count || 0;
      const no = opt.no_count || 0;
      const total = yes + maybe + no;

      const yesPct = total > 0 ? ((yes / total) * 100).toFixed(0) : 0;
      const maybePct = total > 0 ? ((maybe / total) * 100).toFixed(0) : 0;
      const noPct = total > 0 ? ((no / total) * 100).toFixed(0) : 0;

      const isFinalized = data.poll.finalized_slot_id === opt.option_id;
      const formattedLabel = formatSlotTime(opt.start_time, opt.end_time, activeTimeZone);

      const item = document.createElement('div');
      item.className = 'breakdown-item';
      item.innerHTML = `
        <div class="breakdown-header">
          <span>${escapeHtml(formattedLabel)} ${isFinalized ? '<span class="badge badge-finalized">Finalized Winner</span>' : ''}</span>
          <span class="stat-yes">${yes} Yes (${yesPct}%)</span>
        </div>
        <div class="progress-bar-container">
          <div class="bar-yes" style="width: ${yesPct}%"></div>
          <div class="bar-maybe" style="width: ${maybePct}%"></div>
          <div class="bar-no" style="width: ${noPct}%"></div>
        </div>
        <div class="breakdown-stats">
          <span class="stat-yes"><i class="fa-solid fa-circle-check"></i> ${yes} Yes</span>
          <span class="stat-maybe"><i class="fa-solid fa-circle-question"></i> ${maybe} Maybe</span>
          <span class="stat-no"><i class="fa-solid fa-circle-xmark"></i> ${no} No</span>
        </div>
      `;

      resultsBreakdownContainer.appendChild(item);
    });

    // 3. Render Participant Availability Matrix Table
    renderMatrixTable(options, guestMatrix);
  }

  function renderMatrixTable(options, guestMatrix) {
    // Header row: Participant | Option 1 | Option 2 | ...
    matrixHeaderRow.innerHTML = '<th>Participant</th>';
    options.forEach(opt => {
      const th = document.createElement('th');
      th.textContent = formatSlotTime(opt.start_time, opt.end_time, activeTimeZone);
      matrixHeaderRow.appendChild(th);
    });

    // Body rows: Guest Name | Check / Question / Cross for each option
    matrixTableBody.innerHTML = '';

    if (guestMatrix.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="${options.length + 1}" class="text-muted" style="text-align: center;">No responses submitted yet.</td>`;
      matrixTableBody.appendChild(tr);
      return;
    }

    guestMatrix.forEach(guest => {
      const tr = document.createElement('tr');
      let html = `<td><strong>${escapeHtml(guest.name)}</strong></td>`;

      options.forEach(opt => {
        const choice = guest.choices[opt.option_id];
        if (choice === 'yes') {
          html += `<td class="cell-yes" title="Yes"><i class="fa-solid fa-circle-check"></i></td>`;
        } else if (choice === 'maybe') {
          html += `<td class="cell-maybe" title="Maybe"><i class="fa-solid fa-circle-question"></i></td>`;
        } else if (choice === 'no') {
          html += `<td class="cell-no" title="No"><i class="fa-solid fa-circle-xmark"></i></td>`;
        } else {
          html += `<td class="text-muted">-</td>`;
        }
      });

      tr.innerHTML = html;
      matrixTableBody.appendChild(tr);
    });
  }

  // -------------------------------------------------------------
  // Finalize Poll Action
  // -------------------------------------------------------------
  finalizePollBtn.addEventListener('click', async () => {
    if (!activePollId || !activePollData) return;

    // Pick top consensus option
    let topOption = null;
    let maxYes = -1;

    activePollData.options.forEach(opt => {
      if ((opt.yes_count || 0) > maxYes) {
        maxYes = opt.yes_count || 0;
        topOption = opt;
      }
    });

    if (!topOption) {
      showToast('No options available to finalize.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/polls/${activePollId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalized_slot_id: topOption.option_id })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to finalize poll.');

      const finalizedLabel = formatSlotTime(topOption.start_time, topOption.end_time, activeTimeZone);
      showToast(`Poll finalized for: ${finalizedLabel}`, 'success');
      loadPollDetail(activePollId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // -------------------------------------------------------------
  // Manual Delete Poll Action
  // -------------------------------------------------------------
  async function deletePoll(pollId, pollTitle = 'this poll') {
    if (!pollId) return;

    const confirmed = confirm(`Are you sure you want to permanently delete "${pollTitle}" and all of its voting results?\n\nThis action cannot be undone.`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/polls/${pollId}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete poll.');

      showToast('Poll deleted successfully.', 'success');

      if (activePollId === pollId) {
        activePollId = null;
        activePollData = null;
        pollDetailContent.classList.add('hidden');
        noPollSelected.classList.remove('hidden');
      }

      fetchPollsList();
      switchView('listView');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  if (deletePollBtn) {
    deletePollBtn.addEventListener('click', () => {
      if (activePollData && activePollId) {
        deletePoll(activePollId, activePollData.poll.title);
      }
    });
  }

  // -------------------------------------------------------------
  // Utility Functions
  // -------------------------------------------------------------
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
      <span>${escapeHtml(message)}</span>
    `;

    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[m];
    });
  }

  // Initial Route Check on Load
  handleURLRoute();
});
