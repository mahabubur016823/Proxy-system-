// DOM এলিমেন্টসমূহ
const video = document.getElementById('video');
const sidebar = document.getElementById('sidebar');
const controls = document.getElementById('controls');
const loader = document.getElementById('loaderOverlay');
const errorOverlay = document.getElementById('errorOverlay');
const fullscreenBtn = document.getElementById('fullscreen');
const closeErrorBtn = document.getElementById('closeErrorBtn');
const list = document.getElementById('channelList') || document.getElementById('channelsContainer');

let timeout;
let hlsInstance = null;
let serverTimeOffset = 0;
let currentSelectedIndex = 0;
let channels = [];

// চ্যানেল সোর্স এবং সার্ভার কনফিগারেশন
const GITHUB_JSON_URL = "https://raw.githubusercontent.com/ryvoxtb/channels/refs/heads/main/channels_list.json";

// সার্ভার লিঙ্কসমূহ
const PREMIUM_SERVER_URL = "https://premium.ryvoxtb.workers.dev";
const IPTV_SERVER_URL = "https://iptv.ryvoxtb.workers.dev";

const SECRET_KEY = "my_super_secret_tv_key_2026"; 

// প্রিমিয়াম চ্যানেলসমূহ
const premiumChannelIds = ['colors-bangla', 'jalsha-movies-hd', 'star-jalsa-hd', 'zee-bangla', 'BTV'];

// মোবাইল ডিভাইস সনাক্তকরণ
function isMobileDevice() {
    const ua = navigator.userAgent.toLowerCase();
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
    const isTV = /tv|smarttv|googletv|appletv|tizen|webos|hbbtv|netcast|viera/i.test(ua);
    if (isTV) return false;
    return isMobileUA || (window.innerWidth <= 768 && 'ontouchstart' in window);
}

// নির্দিষ্ট পাথ ম্যাপিং
function getChannelPath(id) {
    const pathMap = {
        'colors-bangla': '/COLORS-BANGLA/index.fmp4.m3u8',
        'jalsha-movies-hd': '/JALSHA-MOVIES/index.fmp4.m3u8',
        'star-jalsa-hd': '/STAR-JALSHA/index.fmp4.m3u8',
        'zee-bangla': '/ZEE-BANGLA/index.fmp4.m3u8',
        'BTV': '/BTV/index.fmp4.m3u8'
    };
    return pathMap[id] || `/${id.toUpperCase()}/index.fmp4.m3u8`;
}

// গিটহাব চ্যানেল ডাটা ফেচিং
async function fetchChannels() {
    try {
        const response = await fetch(GITHUB_JSON_URL);
        if (response.ok) {
            channels = await response.json();
        } else {
            throw new Error("Failed to load channel list");
        }
    } catch (e) {
        console.error(e);
        showError();
    }
}

// আকামাই সার্ভার টাইম ট্র্যাকিং
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

// টোকেন ও লিংক জেনারেটর
function generateIPTVUrl(channelId) {
    const synchronizedTimeMs = Date.now() + serverTimeOffset;
    const timeInSeconds = Math.floor(synchronizedTimeMs / 1000);
    const hash = md5(channelId + timeInSeconds + SECRET_KEY).toLowerCase();
    return `${IPTV_SERVER_URL}/live/${channelId}.m3u8?token=${hash}&time=${timeInSeconds}`;
}

// চ্যানেল লিস্ট রেন্ডারিং
function buildChannelList() {
    if (!list) return;
    list.innerHTML = "";
    channels.forEach((ch, index) => {
        const div = document.createElement('div');
        div.className = 'channel-item';
        div.setAttribute('data-index', index);
        
        const logoUrl = ch.logo || 'https://via.placeholder.com/50?text=TV';
        div.innerHTML = `<img src="${logoUrl}" alt="${ch.name}" onerror="this.src='https://via.placeholder.com/50?text=TV'"> <span>${ch.name}</span>`;
        
        div.onclick = () => {
            selectAndPlay(index);
        };
        list.appendChild(div);
    });
}

// চ্যানেল প্লে করার মূল ফাংশন
async function selectAndPlay(index) {
    if (channels.length === 0) return;
    currentSelectedIndex = index;
    
    document.querySelectorAll('.channel-item').forEach((el, idx) => {
        el.classList.remove('active');
        if (idx === index) {
            el.classList.add('active');
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });
    
    hideError();
    showLoader(true);
    resetTimer();

    const channel = channels[index];
    const isPremium = premiumChannelIds.includes(channel.id);

    try {
        if (isPremium) {
            const channelPath = getChannelPath(channel.id);
            const response = await fetch(`${PREMIUM_SERVER_URL}/api/get-link?path=${encodeURIComponent(channelPath)}`);
            if (!response.ok) throw new Error('Premium API response failed');
            
            const serverData = await response.json();
            
            const linkDisplay = document.getElementById('linkDisplay');
            if (linkDisplay) {
                const expiryDate = new Date(serverData.expires * 1000).toLocaleString('bn-BD');
                linkDisplay.innerHTML = `<strong>সার্ভার জেনারেটেড টোকেন:</strong> ${serverData.token}<br>` +
                                        `<strong>মেয়াদ শেষ হবে:</strong> ${expiryDate}<br><br>` +
                                        `<strong>প্লেয়িং লিংক:</strong> <span style="color:#fff;">${serverData.link}</span>`;
            }

            playHLS(serverData.link);
        } else {
            const iptvUrl = generateIPTVUrl(channel.id);
            playHLS(iptvUrl);
        }
    } catch (error) {
        console.warn("Selected server play failed. Attempting fallback to standard IPTV URL.", error);
        const fallbackUrl = generateIPTVUrl(channel.id);
        playHLS(fallbackUrl);
    }
}

// HLS ভিডিও প্লেব্যাক সিস্টেম
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

// ইভেন্ট লিসেনারস
if (video) {
    video.addEventListener('waiting', () => showLoader(true));
    video.addEventListener('playing', () => { showLoader(false); hideError(); });
    video.addEventListener('error', () => showError());
}

function showLoader(status) {
    if (loader) loader.style.display = status ? 'flex' : 'none';
}

function showError() {
    showLoader(false);
    if (errorOverlay) errorOverlay.style.display = 'flex';
}

function hideError() {
    if (errorOverlay) errorOverlay.style.display = 'none';
}

// ডেস্কটপ অটো-স্টার্ট
async function autoStartTVDesktop() {
    const entry = document.getElementById('entryOverlay');
    if (entry) entry.style.display = 'none';
    
    if (video) {
        video.muted = false;
        video.volume = 1.0;
    }
    const volInput = document.getElementById('volume');
    if (volInput) volInput.value = 1.0;

    await syncServerTime();
    await fetchChannels(); 
    buildChannelList();    
    if (channels.length > 0) {
        selectAndPlay(0);      
    }
    resetTimer();
}

// মোবাইল/ম্যানুয়াল স্টার্ট
async function startApp() {
    const entry = document.getElementById('entryOverlay');
    if (entry) {
        entry.style.opacity = '0';
        setTimeout(() => {
            entry.style.display = 'none';
        }, 500);
    }

    if (video) {
        video.muted = false;
        video.volume = 1.0;
    }
    const volInput = document.getElementById('volume');
    if (volInput) volInput.value = 1.0;

    // মোবাইলের জন্য পোর্ট্রেট গ্রিড প্রথমবার স্বাভাবিক দেখার সুবিধা বজায় রাখা হয়েছে
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
    } else {
        fetchChannels().then(() => {
            buildChannelList();
        });
    }
});

// রিমোট কন্ট্রোল এবং সাইডবার অটো-হাইড লজিক
function resetTimer() {
    if (sidebar) sidebar.classList.remove('hidden');
    if (controls) controls.classList.remove('hidden');
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        if (sidebar) sidebar.classList.add('hidden');
        if (controls) controls.classList.add('hidden');
    }, 4000);
}

if (video) video.addEventListener('click', resetTimer);
document.addEventListener('mousemove', resetTimer);
document.addEventListener('touchstart', resetTimer);

// কীবোর্ড এবং টিভির রিমোট কন্ট্রোল বাইন্ডিংস
document.addEventListener('keydown', (e) => {
    if (errorOverlay && errorOverlay.style.display === 'flex') {
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
        if (video) {
            const currentVol = video.volume;
            const newVol = Math.min(1.0, currentVol + 0.1);
            video.volume = Number(newVol.toFixed(1)); 
            video.muted = false;
            const volInput = document.getElementById('volume');
            if (volInput) volInput.value = video.volume;
        }
        resetTimer();
    } 
    else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (video) {
            const currentVol = video.volume;
            const newVol = Math.max(0.0, currentVol - 0.1);
            video.volume = Number(newVol.toFixed(1));
            video.muted = (video.volume === 0);
            const volInput = document.getElementById('volume');
            if (volInput) volInput.value = video.volume;
        }
        resetTimer();
    }
    else if (e.key === 'Enter') {
        e.preventDefault();
        toggleFullscreen();
    }
});

// ফুলস্ক্রিন অ্যাক্টিভেশন
function toggleFullscreen() {
    const wrapper = document.getElementById('playerWrapper');
    if (!wrapper) return;
    if (!document.fullscreenElement) {
        wrapper.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen();
    }
}

// স্লাইডার ভলিউম ইভেন্ট
const volumeSlider = document.getElementById('volume');
if (volumeSlider) {
    volumeSlider.oninput = (e) => {
        if (video) {
            video.volume = e.target.value;
            video.muted = e.target.value == 0;
        }
    };
}

if (fullscreenBtn) fullscreenBtn.onclick = toggleFullscreen;
if (closeErrorBtn) closeErrorBtn.onclick = hideError;

// সিকিউরিটি বাইন্ডিং
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