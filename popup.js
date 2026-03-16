const FIELDS = [
    'firstName', 'lastName', 'email', 'countryCode', 'phone', 'address1', 'address2', 
    'city', 'state', 'zip', 'country', 'workExp', 'currentCTC', 'noticePeriod', 
    'lwd', 'currentLocation', 'prefLocation', 'startDate', 'mandarin', 
    'englishLevel', 'nonCompete', 'relocation', 'source', 'formerDate',
    'disabilityStatus', 'veteranStatus', 'sponsorship', 'legallyPermitted'
];

let savedResumeBase64 = null;
let savedResumeName = null;
let savedCoverBase64 = null;
let savedCoverName = null;
let isTargetPage = false;
let currentTabId = null;

// Initialize Popup Context
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) return;
    const tab = tabs[0];
    currentTabId = tab.id;
    const btn = document.getElementById('ptc-action-btn');
    
    if (tab.url && (tab.url.includes("eightfold.ai") || tab.url.includes("careers.ptc.com"))) {
        isTargetPage = true;
        btn.innerText = "Save & Fill Page";
        btn.style.backgroundColor = "#28a745"; // Green to indicate action
    } else {
        isTargetPage = false;
        btn.innerText = "Save Information";
        btn.style.backgroundColor = "#007bff";
    }
});

// Load Saved Data
chrome.storage.local.get(['ptcProfile', 'ptcFiles'], (result) => {
    if (result.ptcFiles) {
        if (result.ptcFiles.resume) {
            savedResumeBase64 = result.ptcFiles.resume;
            savedResumeName = result.ptcFiles.resumeName;
            document.getElementById('ptc-resume-status').innerText = `✓ ${savedResumeName}`;
        }
        if (result.ptcFiles.cover) {
            savedCoverBase64 = result.ptcFiles.cover;
            savedCoverName = result.ptcFiles.coverName;
            document.getElementById('ptc-cover-status').innerText = `✓ ${savedCoverName}`;
        }
    }

    if (result.ptcProfile) {
        FIELDS.forEach(id => {
            const el = document.getElementById(`ptc-${id}`);
            if (el && result.ptcProfile[id]) el.value = result.ptcProfile[id];
        });
    }
});

// File Upload Handlers
document.getElementById('ptc-upload-resume-btn').addEventListener('click', () => document.getElementById('ptc-resume-file').click());
document.getElementById('ptc-resume-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        savedResumeBase64 = event.target.result;
        savedResumeName = file.name;
        document.getElementById('ptc-resume-status').innerText = `✓ ${file.name}`;
    };
    reader.readAsDataURL(file);
});

document.getElementById('ptc-upload-cover-btn').addEventListener('click', () => document.getElementById('ptc-cover-file').click());
document.getElementById('ptc-cover-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        savedCoverBase64 = event.target.result;
        savedCoverName = file.name;
        document.getElementById('ptc-cover-status').innerText = `✓ ${file.name}`;
    };
    reader.readAsDataURL(file);
});

// Save and Execute Logic
document.getElementById('ptc-action-btn').addEventListener('click', () => {
    const btn = document.getElementById('ptc-action-btn');
    btn.innerText = "Processing...";
    
    const profileData = {};
    FIELDS.forEach(id => { profileData[id] = document.getElementById(`ptc-${id}`).value; });
    
    const fileData = {
        resume: savedResumeBase64,
        resumeName: savedResumeName,
        cover: savedCoverBase64,
        coverName: savedCoverName
    };

    chrome.storage.local.set({ ptcProfile: profileData, ptcFiles: fileData }, () => {
        if (!isTargetPage) {
            btn.innerText = "Saved Successfully!";
            setTimeout(() => window.close(), 1000);
            return;
        }

        // Target page logic: message the content script
        chrome.tabs.sendMessage(currentTabId, { action: "START_FILL" }, (response) => {
            // If content script isn't active yet, inject it manually then message it.
            if (chrome.runtime.lastError) {
                chrome.scripting.executeScript({
                    target: { tabId: currentTabId },
                    files: ["content.js"]
                }, () => {
                    chrome.tabs.sendMessage(currentTabId, { action: "START_FILL" });
                    window.close();
                });
            } else {
                window.close();
            }
        });
    });
});