// 1. Auto-Prompt Modal Initialization
function initPromptModal() {
    // Only run if we are on a target page
    if (!window.location.href.includes("eightfold.ai") && !window.location.href.includes("careers.ptc.com")) return;
    if (document.getElementById('ptc-prompt-modal')) return;

    chrome.storage.local.get(['ptcProfile', 'ptcFiles'], (result) => {
        if (result.ptcProfile && Object.keys(result.ptcProfile).length > 0) {
            const promptModal = document.createElement('div');
            promptModal.id = 'ptc-prompt-modal';
            promptModal.innerHTML = `
                <div style="font-family: Arial, sans-serif; padding: 20px; background: #fff; border: 2px solid #007bff; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); position: fixed; top: 20px; right: 20px; width: 300px; z-index: 2147483647;">
                    <h3 style="margin-top: 0; color: #333; font-size: 18px; border-bottom: 1px solid #ddd; padding-bottom: 10px;">PTC Auto-Filler Ready</h3>
                    <button id="ptc-fill-now-btn" style="display: block; width: 100%; padding: 10px; margin-bottom: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Fill Now</button>
                    <button id="ptc-edit-details-btn" style="display: block; width: 100%; padding: 10px; margin-bottom: 10px; background: #e0e0e0; color: #333; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">I want to edit details</button>
                    <button id="ptc-dismiss-btn" style="display: block; width: 100%; padding: 10px; background: #ffcccc; color: #900; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Dismiss</button>
                </div>
            `;
            document.body.appendChild(promptModal);

            document.getElementById('ptc-fill-now-btn').addEventListener('click', () => {
                promptModal.remove();
                fillEightfoldForm(result.ptcProfile || {});
                injectFilesSynthetic(result.ptcFiles || {});
            });

            document.getElementById('ptc-edit-details-btn').addEventListener('click', () => {
                alert("Browser security prevents opening the extension automatically. Please click the PTC Auto-Filler extension icon in your top right toolbar to edit your data.");
            });

            document.getElementById('ptc-dismiss-btn').addEventListener('click', () => {
                promptModal.remove();
            });
        }
    });
}

// Inject the modal when the page loads
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPromptModal);
} else {
    initPromptModal();
}

// 2. Listener for commands coming from the Popup button
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "START_FILL") {
        const modal = document.getElementById('ptc-prompt-modal');
        if (modal) modal.remove(); // Clear modal if user clicked "Save & Fill" from popup
        
        chrome.storage.local.get(['ptcProfile', 'ptcFiles'], (result) => {
            if (result.ptcProfile) fillEightfoldForm(result.ptcProfile);
            if (result.ptcFiles) injectFilesSynthetic(result.ptcFiles);
        });
        sendResponse({status: "filling_started"});
    }
    return true;
});

// 3. Form Filling Engine
function simulateHumanInput(element, value) {
    if (!element || value === undefined || value === null || value === "") return;

    const stringValue = String(value);
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
    ).set;

    element.focus();
    nativeInputValueSetter.call(element, stringValue);

    let reactOnChange = null;
    let reactOnBlur = null;
    let searchNode = element;

    for (let i = 0; i < 5; i++) {
        if (!searchNode) break;
        const reactKey = Object.keys(searchNode).find(k => k.startsWith('__reactProps'));
        if (reactKey) {
            const props = searchNode[reactKey];
            if (typeof props.onChange === 'function') reactOnChange = props.onChange;
            if (typeof props.onBlur === 'function') reactOnBlur = props.onBlur;
            break;
        }
        searchNode = searchNode.parentElement;
    }

    if (reactOnChange) {
        reactOnChange({
            target: element, currentTarget: element, type: 'change', bubbles: true,
            preventDefault: () => {}, stopPropagation: () => {}, persist: () => {}
        });
    } else {
        element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: stringValue }));
        element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    }

    if (reactOnBlur) {
        reactOnBlur({
            target: element, currentTarget: element, type: 'blur', bubbles: true,
            preventDefault: () => {}, stopPropagation: () => {}, persist: () => {}
        });
    } else {
        element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    }

    element.blur();
}

function fillCombobox(testId, value) {
    if (!value) return;
    const wrapper = document.querySelector(`[data-test-id="${testId}"]`);
    if (!wrapper) return;
    
    const input = wrapper.querySelector('input[role="combobox"]');
    if (!input) return;

    input.focus();
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    input.click();

    simulateHumanInput(input, value);

    let attempts = 0;
    const intervalId = setInterval(() => {
        attempts++;
        const options = document.querySelectorAll('div[role="option"], li[role="option"]');
        let clicked = false;

        for (const opt of options) {
            const optText = opt.innerText.toLowerCase().trim();
            const valText = value.toString().toLowerCase().trim();
            
            if (optText === valText || optText.includes(valText)) {
                opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                opt.click();
                clicked = true;
                break;
            }
        }

        if (clicked || attempts >= 15) {
            clearInterval(intervalId);
            if (!clicked) {
                input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter' }));
            }
        }
    }, 100);
}

function fillEightfoldForm(data) {
    setTimeout(() => {
        const textFields = [
            { id: 'Contact_Information_firstname',                    value: data.firstName },
            { id: 'Contact_Information_lastname',                     value: data.lastName },
            { id: 'Contact_Information_email',                        value: data.email },
            { id: 'Contact_Information_phone',                        value: data.phone ? data.phone.replace(/[^\d]/g, '') : "" },
            { id: 'Address_Address_Line_1',                           value: data.address1 },
            { id: 'Address_Address_Line_2',                           value: data.address2 },
            { id: 'Address_City',                                     value: data.city },
            { id: 'Address_State',                                    value: data.state },
            { id: 'Address_Postal_Code',                              value: data.zip },
            { id: 'Application_questions_ind_work_exp',               value: data.workExp },
            { id: 'Application_questions_ind_fixed_ctc',              value: data.currentCTC },
            { id: 'Application_questions_ind_cur_job_location',       value: data.currentLocation },
            { id: 'Application_questions_ind_pref_job_location',      value: data.prefLocation },
            { id: 'Application_questions_apac_annual_salary',         value: data.currentCTC }
        ];

        textFields.forEach(({ id, value }, index) => {
            setTimeout(() => {
                const el = document.querySelector(`[data-test-id="${id}"]`);
                if (el) simulateHumanInput(el, value);
            }, index * 200);
        });

        const dateDelay = textFields.length * 200 + 300;

        const dateFields = [
            { id: 'Application_questions_ind_lwd',                    value: data.lwd },
            { id: 'Position_Specific_Questions_Question_Setup_1',     value: data.startDate },
            { id: 'Source_Former_Employee_Last_Date',                  value: data.formerDate }
        ];

        dateFields.forEach(({ id, value }, index) => {
            setTimeout(() => {
                const el = document.querySelector(`[data-test-id="${id}"]`);
                if (el && value) {
                    el.removeAttribute('readonly');
                    simulateHumanInput(el, value);
                }
            }, dateDelay + index * 200);
        });

        const comboDelay = dateDelay + dateFields.length * 200 + 300;

        const comboboxes = [
            { id: 'Contact_Information_phone-country-code',                   value: data.countryCode },
            { id: 'Source_Applicant_Source_ID',                               value: data.source },
            { id: 'Relocation_Relocation',                                    value: data.relocation },
            { id: 'Application_questions_apac_japan_mandrin_speaker',         value: data.mandarin },
            { id: 'Application_questions_apac_japan_eng_lvl',                 value: data.englishLevel },
            { id: 'Application_questions_apac_japan_non_compeye_sign',        value: data.nonCompete },
            { id: 'Position_Specific_Questions_QUESTION_SETUP_6_24',          value: data.legallyPermitted },
            { id: 'Position_Specific_Questions_QUESTION_SETUP_6_25',          value: data.sponsorship },
            { id: 'Address_Country_Reference',                                 value: data.country }
        ];

        comboboxes.forEach(({ id, value }, index) => {
            setTimeout(() => { fillCombobox(id, value); }, comboDelay + index * 200);
        });

    }, 500);
}

function injectFilesSynthetic(fileData) {
    if (!fileData) return;
    
    setTimeout(() => {
        const dropContainers = document.querySelectorAll('.upload-module_upload-drop-container__cWOeU');
        
        dropContainers.forEach(container => {
            const section = container.closest('section') || container.closest('.applyFormSectionCard-1yzIZ');
            const isCoverLetter = section && section.innerText.toLowerCase().includes('cover letter');

            const targetBase64 = isCoverLetter ? fileData.cover : fileData.resume;
            const targetName = isCoverLetter ? fileData.coverName : fileData.resumeName;

            if (targetBase64 && targetName) {
                try {
                    const arr = targetBase64.split(',');
                    const mime = arr[0].match(/:(.*?);/)[1];
                    const bstr = atob(arr[1]);
                    let n = bstr.length;
                    const u8arr = new Uint8Array(n);
                    while(n--){ u8arr[n] = bstr.charCodeAt(n); }
                    const file = new File([u8arr], targetName, {type: mime});

                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    
                    const dropEvent = new DragEvent('drop', {
                        bubbles: true,
                        cancelable: true,
                        dataTransfer: dataTransfer
                    });

                    container.dispatchEvent(dropEvent);
                } catch (e) {
                    console.error("PTC Auto-Filler: Failed to synthesize drop event.", e);
                }
            }
        });
    }, 1000); 
}