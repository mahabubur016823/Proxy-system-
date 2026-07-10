const video = document.getElementById('video');
const sidebar = document.getElementById('sidebar');
const controls = document.getElementById('controls');
const loader = document.getElementById('loaderOverlay');
const errorOverlay = document.getElementById('errorOverlay');
const fullscreenBtn = document.getElementById('fullscreen');
const closeErrorBtn = document.getElementById('closeErrorBtn');
const list = document.getElementById('channelList');

let timeout;
let hlsInstance = null;
let serverTimeOffset = 0;
let currentSelectedIndex = 0;
let channels = [];

const _0xW = atob("aHR0cHM6Ly9pcHR2LnJ5dm94dGIud29ya2Vycy5kZXY=");
const _0xK = atob("bXlfc3VwZXJfc2VjcmV0X3R2X2tleV8yMDI2"); 
const _0xG = atob("aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL3J5dm94dGIvU3BvcnRzL21haW4vU3BvcnRzLXR2Lmpzb24="); // GITHUB_CHANNELS_JSON_URL

function isMobileDevice() {
    const ua = navigator.userAgent.toLowerCase();
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
    const isTV = /tv|smarttv|googletv|appletv|tizen|webos|hbbtv|netcast|viera/i.test(ua);
    if (isTV) return false;
    return isMobileUA || (window.innerWidth <= 768 && 'ontouchstart' in window);
}

async function fetchChannels() {
    try {
        const response = await fetch(_0xG);
        if (response.ok) {
            channels = await response.json();
        } else {
            throw new Error();
        }
    } catch (e) {
        showError();
    }
}

async function syncServerTime() {
    try {
        const start = Date.now();
        const response = await fetch("https://time.akamai.com/");
        if (response.ok) {
            const text = await response.text();
            const serverTimeSec = parseInt(text.trim());
            if (!isNaN(serverTimeSec)) {
                const serverTimeMs = serverTimeSec * 1000;
                const localTimeMs = start + (Date.now() - start) / 2;
                serverTimeOffset = serverTimeMs - localTimeMs;
            }
        }
    } catch (e) {
        console.warn("Time sync error, using local clock.");
    }
}

function generateProxyUrl(channelId) {
    const synchronizedTimeMs = Date.now() + serverTimeOffset;
    const timeInSeconds = Math.floor(synchronizedTimeMs / 1000);
    const hash = md5(channelId + timeInSeconds + _0xK).toLowerCase();
    return `${_0xW}/live/${channelId}.m3u8?token=${hash}&time=${timeInSeconds}`;
}

function buildChannelList() {
    list.innerHTML = "";
    channels.forEach((ch, index) => {
        const div = document.createElement('div');
        div.className = 'channel-item';
        div.setAttribute('data-index', index);
        div.innerHTML = `<img src="${ch.logo}" alt="${ch.name}"> <span>${ch.name}</span>`;
        div.onclick = () => {
            selectAndPlay(index);
        };
        list.appendChild(div);
    });
}

function selectAndPlay(index) {
    if (channels.length === 0) return;
    currentSelectedIndex = index;
    document.querySelectorAll('.channel-item').forEach((el, idx) => {
        el.classList.remove('active');
        if(idx === index) {
            el.classList.add('active');
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });
    
    hideError();
    showLoader(true);
    const proxyUrl = generateProxyUrl(channels[index].id);
    playHLS(proxyUrl);
    resetTimer();
}

function playHLS(url) {
    if (hlsInstance) {
        hlsInstance.destroy();
    }

    if (Hls.isSupported()) {
        hlsInstance = new Hls({ 
            maxMaxBufferLength: 10, 
            enableWorker: true,
            lowLatencyMode: true 
        });
        hlsInstance.loadSource(url);
        hlsInstance.attachMedia(video);
        
        hlsInstance.on(Hls.Events.ERROR, function (event, data) {
            if (data.fatal) {
                showError();
            }
        });
        video.play().catch(() => {});
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.play().catch(() => {});
    }
}

video.addEventListener('waiting', () => showLoader(true));
video.addEventListener('playing', () => { showLoader(false); hideError(); });
video.addEventListener('error', () => showError());

function showLoader(status) {
    loader.style.display = status ? 'flex' : 'none';
}

function showError() {
    showLoader(false);
    errorOverlay.style.display = 'flex';
}

function hideError() {
    errorOverlay.style.display = 'none';
}

async function autoStartTVDesktop() {
    document.getElementById('entryOverlay').style.display = 'none';
    
    video.muted = false;
    video.volume = 1.0;
    document.getElementById('volume').value = 1.0;

    await syncServerTime();
    await fetchChannels(); 
    buildChannelList();    
    if (channels.length > 0) {
        selectAndPlay(0);      
    }
    resetTimer();
}

async function startApp() {
    document.getElementById('entryOverlay').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('entryOverlay').style.display = 'none';
    }, 500);

    video.muted = false;
    video.volume = 1.0;
    document.getElementById('volume').value = 1.0;

    if (isMobileDevice()) {
        try {
            const wrapper = document.getElementById('playerWrapper');
            if (wrapper.requestFullscreen) {
                await wrapper.requestFullscreen();
            } else if (wrapper.webkitRequestFullscreen) {
                await wrapper.webkitRequestFullscreen();
            }
            if (screen.orientation && screen.orientation.lock) {
                await screen.orientation.lock('landscape').catch(() => {});
            }
        } catch (err) {
            console.log("Auto-rotation check skipped on this mobile device.");
        }
    }

    await syncServerTime();
    await fetchChannels(); 
    buildChannelList();    
    if (channels.length > 0) {
        selectAndPlay(0);      
    }
    resetTimer();
}

window.addEventListener('DOMContentLoaded', () => {
    if (!isMobileDevice()) {
        autoStartTVDesktop();
    }
});

function resetTimer() {
    sidebar.classList.remove('hidden');
    controls.classList.remove('hidden');
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        sidebar.classList.add('hidden');
        controls.classList.add('hidden');
    }, 4000);
}

video.addEventListener('click', resetTimer);
document.addEventListener('mousemove', resetTimer);
document.addEventListener('touchstart', resetTimer);

document.addEventListener('keydown', (e) => {
    if (errorOverlay.style.display === 'flex') {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Escape') {
            hideError();
        }
    }

    if (channels.length === 0) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        currentSelectedIndex = (currentSelectedIndex + 1) % channels.length;
        selectAndPlay(currentSelectedIndex);
    } 
    else if (e.key === 'ArrowUp') {
        e.preventDefault();
        currentSelectedIndex = (currentSelectedIndex - 1 + channels.length) % channels.length;
        selectAndPlay(currentSelectedIndex);
    } 
    else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const currentVol = video.volume;
        const newVol = Math.min(1.0, currentVol + 0.1);
        video.volume = Number(newVol.toFixed(1)); 
        video.muted = false;
        document.getElementById('volume').value = video.volume;
        resetTimer();
    } 
    else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const currentVol = video.volume;
        const newVol = Math.max(0.0, currentVol - 0.1);
        video.volume = Number(newVol.toFixed(1));
        video.muted = (video.volume === 0);
        document.getElementById('volume').value = video.volume;
        resetTimer();
    }
    else if (e.key === 'Enter') {
        e.preventDefault();
        toggleFullscreen();
    }
});

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.getElementById('playerWrapper').requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen();
    }
}

document.getElementById('volume').oninput = (e) => {
    video.volume = e.target.value;
    video.muted = e.target.value == 0;
};

fullscreenBtn.onclick = toggleFullscreen;
closeErrorBtn.onclick = hideError;

document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) || 
        (e.ctrlKey && e.key === 'u') || 
        (e.ctrlKey && e.key === 'U')) {
        e.preventDefault();
        return false;
    }
});
