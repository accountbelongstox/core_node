let cachedGroupData = {}; // Cache the group data globally

function validateForm() {
    const url = document.getElementById("urlSubscribleText").value;
    const pattern = /^(https?:\/\/)?.+$/;

    if (typeof url === 'string' && url.includes("proxies")) {
        const confirmation = confirm("You are submitting a YAML configuration file that contains 'proxies'. Do you want to continue?");
        if (confirmation) {
            return true;
        }
    }

    if (!pattern.test(url)) {
        alert("Invalid URL. Please enter a valid URL.");
        return false;
    }


    return true;
}


// Function to handle group change
function changeGroup() {
    const selectedGroup = document.getElementById('group').value;
    window.location.href = `/?group=${selectedGroup}`;
}

// Universal function to handle POST requests
async function postData(url, body) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body
        });
        const result = await response.json();
        if (response.ok && result.success) {
            return result;
        } else {
            throw new Error(result.message || "Error occurred");
        }
    } catch (error) {
        console.error(error.message);
        throw error;
    }
}

// Fetch request to create a new group
async function createGroup(event) {
    event.preventDefault(); // Prevent form submission
    const newGroup = document.getElementById('newGroup').value;

    if (!newGroup) {
        alert("Please enter a group name.");
        return;
    }

    try {
        const result = await postData('/new_group', `group_name=${encodeURIComponent(newGroup)}`);
        alert(result.message);
        location.reload(); // Reload the page on success
    } catch (error) {
        alert("An error occurred. Please try again.");
    }
}

// Fetch request to submit URL with the selected group
async function submitUrl(event) {
    event.preventDefault(); // Prevent form submission

    const url = document.getElementById("urlSubscribleText").value;
    const currentGroup = getGroupFromURL(); // Use the function to get the group from URL

    if (!validateForm()) {
        return;
    }

    try {
        const result = await postData('/submit_url', `urlSubscribleText=${encodeURIComponent(url)}&group=${encodeURIComponent(currentGroup)}`);
        alert(result.message);
        location.reload(); // Reload the page on success
    } catch (error) {
        alert("An error occurred. Please try again.");
    }
}

// Function to fetch group data
async function fetchGroupData(groupName) {
    try {
        const result = await postData('/get_groups', `group_name=${encodeURIComponent(groupName)}`);
        return result.data;  // Return the fetched group data
    } catch (error) {
        console.error('Error fetching group data:', error);
        return {};  // Default empty data on error
    }
}

async function renderJsonList() {
    const groupName = getGroupFromURL(); // Get the group name from the URL
    const groupData = await fetchGroupData(groupName);

    cachedGroupData = groupData; // Cache the fetched group data globally

    const listElement = document.getElementById('json-list');
    listElement.innerHTML = '';  // Clear current list

    // Add the table header
    const headerElement = document.getElementById('json-list-header');
    headerElement.innerHTML = `
        <div class="url-entry header-row">
            <span class="url"><strong>Subscribe URL</strong></span>
            <span class="submission-time"><strong>Submission Time</strong></span>
            <span class="expiry-time"><strong>Expiry Time</strong></span>
            <span class="actions"><strong>Actions</strong></span>
        </div>
    `;

    // Iterate over each key in the groupData object
    Object.keys(groupData).forEach((key, index) => {
        const item = groupData[key]; // Get the corresponding item (object)

        const listItem = document.createElement('li');
        listItem.classList.add(index % 2 === 0 ? 'even' : 'odd');

        listItem.innerHTML = `
            <div class="url-entry">
                <span class="url">${item.subscribe_url ? item.subscribe_url : 'N/A'}</span>
                <span class="submission-time"> ${item.submissionTime}</span>
                <span class="expiry-time"> ${item.expiryTime}</span>
                <div class="actions">
                    <button class="action-btn edit-btn" onclick="editEntry('${item.id}')">Edit</button>
                    <button class="action-btn delete-btn" onclick="deleteEntry('${item.md5}')">Delete</button>
                </div>
            </div>
        `;
        listElement.appendChild(listItem);
    });
}


// Function to get group name from the URL
function getGroupFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('group') || 'default';
}

function openModal(entry) {
    document.getElementById('editUrl').value = Array.isArray(entry.subscribe_url) ? entry.subscribe_url[0] : entry.subscribe_url;
    document.getElementById('editSubmissionTime').value = Array.isArray(entry.submissionTime) ? entry.submissionTime[0] : entry.submissionTime;
    document.getElementById('editExpiryTime').value = Array.isArray(entry.expiryTime) ? entry.expiryTime[0] : entry.expiryTime;
    document.getElementById('editId').value = Array.isArray(entry.id) ? entry.id[0] : entry.id;
    document.getElementById('editMd5').value = Array.isArray(entry.md5) ? entry.md5[0] : entry.md5;
    document.getElementById('editModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('editModal').style.display = 'none';
}

function findEntryByIdOrMd5(id) {
    return Object.values(cachedGroupData).find(item => (item.id == id));
}

function editEntry(id) {
    const entry = findEntryByIdOrMd5(id);
    if (entry) {
        openModal(entry); // Open modal with the selected entry data
    } else {
        alert(`Entry not found. id:${id}`);
    }
}

// Delete Entry
async function deleteEntry(id) {
    const currentGroup = getGroupFromURL();
    try {
        const result = await postData('/delete_url', `group=${encodeURIComponent(currentGroup)}&url_md5=${encodeURIComponent(id)}`);
        
        if (result.success) {
            alert(result.message);
            await renderJsonList();  // 重新渲染列表以反映删除
        } else {
            alert(`Failed to delete: ${result.message}`);
        }
    } catch (error) {
        console.error('Error deleting entry:', error);
        alert("An error occurred while deleting. Please try again.");
    }
}

// Save Changes from Edit
document.getElementById('editForm').addEventListener('submit', async function (event) {
    event.preventDefault();

    const id = document.getElementById('editId').value;
    const url = document.getElementById('editUrl').value;
    const submissionTime = document.getElementById('editSubmissionTime').value;
    const expiryTime = document.getElementById('editExpiryTime').value;
    const md5Url = document.getElementById('editMd5').value;
    const currentGroup = getGroupFromURL();

    // Validate inputs
    if (!id || !url || !submissionTime || !expiryTime || !md5Url) {
        alert("All fields are required.");
        return;
    }

    // Convert dates to timestamps
    const submissionTimestamp = new Date(submissionTime).getTime();
    const expiryTimestamp = new Date(expiryTime).getTime();

    if (isNaN(submissionTimestamp) || isNaN(expiryTimestamp)) {
        alert("Invalid date format. Please use a valid date.");
        return;
    }

    try {
        const result = await postData('/update_url', 
            `id=${encodeURIComponent(id)}&` +
            `subscribe_url=${encodeURIComponent(url)}&` +
            `submissionTime=${encodeURIComponent(submissionTimestamp)}&` +
            `expiryTime=${encodeURIComponent(expiryTimestamp)}&` +
            `url_md5=${encodeURIComponent(md5Url)}&` +
            `group=${encodeURIComponent(currentGroup)}`
        );
        
        if (result.success) {
            alert(result.message);
            await renderJsonList();  // Re-render list with updated entry
            closeModal();  // Close the modal
        } else {
            if (result.data) {
                alert(`Failed to update: ${result.message}\n\nSubmitted ID: ${result.data.submitted_id}\nSubmitted MD5: ${result.data.submitted_md5}\nAvailable IDs: ${result.data.available_ids.join(', ')}\nAvailable MD5s: ${result.data.available_md5s.join(', ')}`);
            } else {
                alert("Failed to update: " + result.message);
            }
        }
    } catch (error) {
        console.error('Error updating URL:', error);
        alert("An error occurred while updating. Please try again.");
    }
});

function setSubscriptionUrl() {
    const currentGroup = document.getElementById('currentGroup').innerText || 'default';
    const url = `${window.location.origin}/sub?group=${currentGroup}&template=custom`;
    document.getElementById('subscriptionUrl').innerText = url;
}

document.addEventListener('DOMContentLoaded', setSubscriptionUrl);

document.addEventListener('DOMContentLoaded', renderJsonList);

async function fetchSystemInfo() {
    try {
        const response = await fetch('/system_info');
        const result = await response.json();
        if (result.success) {
            displaySystemInfo(result.data);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Error fetching system info:', error);
        document.getElementById('systemInfoContent').innerHTML = 'Error loading system information.';
    }
}

function displaySystemInfo(info) {
    const systemInfoElement = document.getElementById('systemInfoContent');
    let htmlContent = '<ul>';

    function formatValue(value) {
        if (typeof value === 'object' && value !== null) {
            // Create a single line of key-value pairs for the object
            let objectContent = '';
            for (const [key, val] of Object.entries(value)) {
                objectContent += `${key}: ${val}, `;
            }
            // Remove the trailing comma and space
            return objectContent.slice(0, -2);
        } else {
            return value; // For primitive types, just return the value
        }
    }

    for (const [key, value] of Object.entries(info)) {
        htmlContent += `<li><strong>${key}:</strong> ${formatValue(value)}</li>`;
    }

    htmlContent += '</ul>';
    systemInfoElement.innerHTML = htmlContent;
}



// 修改 DOMContentLoaded 事件监听器
document.addEventListener('DOMContentLoaded', () => {
    setSubscriptionUrl();
    renderJsonList();
    fetchSystemInfo();
});

// ... (existing code) ...

async function performPuppeteerAction(action) {
    try {
        const response = await fetch(`/puppeteer_action/${action}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const result = await response.json();
        displayPuppeteerResult(result);
    } catch (error) {
        console.error(`Error during ${action}:`, error);
        displayPuppeteerResult({ success: false, message: `Error: ${error.message}` });
    }
}

function displayPuppeteerResult(result) {
    const resultContent = document.getElementById('puppeteerResultContent');
    const screenshotDiv = document.getElementById('puppeteerScreenshot');
    const actionResult = (result.data && result.data.result) ? result.data.result : ``;
    
    resultContent.innerHTML = `
        <p>Success: ${result.success}</p>
        <p>Message: ${result.message}</p>
        <p>Result: ${formatObject(actionResult)}</p>
    `;

    if (result.data && result.data.screenshot) {
        screenshotDiv.innerHTML = `
            <img 
                src="${result.data.screenshot}" 
                alt="Puppeteer Action Screenshot" 
                style="max-width: 100%; max-height: 300px; object-fit: contain;"
            />
        `;
    } else {
        screenshotDiv.innerHTML = '';
    }
}

function formatObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return obj; 
    }

    let formatted = '<ul>';
    for (const [key, value] of Object.entries(obj)) {
        formatted += `<li><strong>${key}:</strong> ${formatObject(value)}</li>`;
    }
    formatted += '</ul>';
    return formatted;
}

document.addEventListener('DOMContentLoaded', () => {
    // ... (existing code) ...

    document.getElementById('loginBtn').addEventListener('click', () => performPuppeteerAction('login'));
    document.getElementById('openOpenClashBtn').addEventListener('click', () => performPuppeteerAction('open_openclash'));
    document.getElementById('openYacdBtn').addEventListener('click', () => performPuppeteerAction('open_yacd'));
    document.getElementById('getProxyInfoBtn').addEventListener('click', () => performPuppeteerAction('get_proxy_info'));
});