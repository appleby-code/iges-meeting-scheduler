// IGES Meeting Scheduler Client Application Logic

document.addEventListener('DOMContentLoaded', () => {
  // App State
  let activePollId = null;
  let activePollData = null;
  let selectedVotes = {}; // { [option_id]: 'yes' | 'maybe' | 'no' }

  // DOM Elements
  const navBtns = document.querySelectorAll('.nav-btn');
  const viewSections = document.querySelectorAll('.view-section');
  const brandLogo = document.getElementById('brandLogo');

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
  const shareLinkInput = document.getElementById('shareLinkInput');
  const copyShareLinkBtn = document.getElementById('copyShareLinkBtn');

  // Toast Container
  const toastContainer = document.getElementById('toastContainer');

  // -------------------------------------------------------------
  // Navigation, Routing & View Switching
  // -------------------------------------------------------------
  function switchView(targetViewId, updateHistory = true) {
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
      if (updateHistory) history.pushState(null, '', `/poll/${activePollId}`);
    }
  }

  function handleURLRoute() {
    const path = window.location.pathname;
    const hash = window.location.hash;

    // Match /poll/:id or #poll/:id
    const pathMatch = path.match(/^\/poll\/([a-zA-Z0-9-]+)/);
    const hashMatch = hash.match(/^#poll\/([a-zA-Z0-9-]+)/);

    const pollId = pathMatch ? pathMatch[1] : (hashMatch ? hashMatch[1] : null);

    if (pollId) {
      activePollId = pollId;
      loadPollDetail(pollId);
      switchView('detailView', false);
    } else if (path === '/polls' || hash === '#polls') {
      switchView('listView', false);
    } else {
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

  brandLogo.addEventListener('click', () => switchView('createView'));
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

    const slotElements = slotsContainer.querySelectorAll('.slot-item');
    const options = [];

    slotElements.forEach(item => {
      const dateVal = item.querySelector('.slot-date').value;
      const startVal = item.querySelector('.slot-start').value;
      const endVal = item.querySelector('.slot-end').value;

      if (dateVal && startVal && endVal) {
        const slot_label = `${dateVal} ${startVal} - ${endVal}`;
        options.push({
          start_time: `${dateVal}T${startVal}:00`,
          end_time: `${dateVal}T${endVal}:00`,
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
          <div class="poll-card-title">${escapeHtml(poll.title)}</div>
          <div class="poll-card-meta">
            <span><i class="fa-solid fa-user"></i> ${escapeHtml(poll.organizer_name)}</span>
            <span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(poll.location || 'N/A')}</span>
            <span><i class="fa-solid fa-clock"></i> ${new Date(poll.created_at).toLocaleString()}</span>
          </div>
        `;
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

      if (data.poll.status === 'finalized') {
        pollStatusBadge.textContent = 'Finalized';
        pollStatusBadge.className = 'badge badge-finalized';
      } else {
        pollStatusBadge.textContent = 'Active Poll';
        pollStatusBadge.className = 'badge badge-active';
      }

      // Update Shareable Invite Link Input & Address Bar URL
      const shareUrl = `${window.location.origin}/poll/${pollId}`;
      if (shareLinkInput) {
        shareLinkInput.value = shareUrl;
      }
      if (window.location.pathname !== `/poll/${pollId}`) {
        history.pushState(null, '', `/poll/${pollId}`);
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

      const row = document.createElement('div');
      row.className = 'vote-slot-row';
      row.setAttribute('data-option-id', opt.option_id);

      row.innerHTML = `
        <div class="slot-label-text">
          <i class="fa-solid fa-calendar-day accent-icon"></i>
          <span>${escapeHtml(opt.slot_label)}</span>
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
      topSlotLabel.textContent = topOption.slot_label;
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

      const item = document.createElement('div');
      item.className = 'breakdown-item';
      item.innerHTML = `
        <div class="breakdown-header">
          <span>${escapeHtml(opt.slot_label)} ${isFinalized ? '<span class="badge badge-finalized">Finalized Winner</span>' : ''}</span>
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
      th.textContent = opt.slot_label;
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

      showToast(`Poll finalized for: ${topOption.slot_label}`, 'success');
      loadPollDetail(activePollId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

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
