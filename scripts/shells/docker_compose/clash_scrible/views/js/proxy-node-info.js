function getGroupFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('group') || 'default';
}

document.addEventListener('DOMContentLoaded', () => {
    const nodeInfoBtn = document.getElementById('nodeInfoBtn');
    const nodeInfoModal = document.getElementById('nodeInfoModal');
    const closeNodeInfoBtn = document.getElementById('closeNodeInfoBtn');
    const nodeInfoContent = document.getElementById('nodeInfoContent');

    nodeInfoBtn.addEventListener('click', fetchNodeInfo);
    closeNodeInfoBtn.addEventListener('click', closeNodeInfoModal);

    function fetchNodeInfo() {
        const group = getGroupFromURL();
        fetch(`/api/proxy-node-info?group=${group}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    displayNodeInfo(data.data);
                } else {
                    throw new Error(data.message || 'Failed to fetch node info');
                }
                nodeInfoModal.style.display = 'block';
            })
            .catch(error => {
                console.error('Error fetching node info:', error);
                nodeInfoContent.innerHTML = `<p>Error fetching node information: ${error.message}</p>`;
                nodeInfoModal.style.display = 'block';
            });
    }

    function displayNodeInfo(data) {
        let html = '';
        for (const [title, list] of Object.entries(data)) {
            html += `<h3>${title}</h3><ul>`;
            list.forEach(item => {
                html += `<li>${item}</li>`;
            });
            html += '</ul>';
        }
        nodeInfoContent.innerHTML = html;
    }

    function closeNodeInfoModal() {
        nodeInfoModal.style.display = 'none';
    }
});
