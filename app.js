// إعدادات Firebase
const firebaseConfig = {
    apiKey: "AIzaSyClNv4LaNoGWCVWzgEllo-9cZ1qvlBlEUU",
    authDomain: "quill-bot-screen-13ecb.firebaseapp.com",
    projectId: "quill-bot-screen-13ecb",
    storageBucket: "quill-bot-screen-13ecb.firebasestorage.app",
    messagingSenderId: "527652332387",
    appId: "1:527652332387:web:8ce6416e124e42929b2956"
};

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();
const auth = firebase.auth();

const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = secondaryApp.auth();

// متغيرات التطبيق
let currentUserDoc = null;
let screens = [];
let selectedScreens = [];
let selectedMedia = [];
let selectedMediaIndex = -1;
let deviceName = localStorage.getItem('deviceName') || "Web App";
let isDarkMode = localStorage.getItem('isDarkMode') !== 'false';
let selectedMedia = [];
let selectedMediaIndex = -1;

// عناصر الواجهة
const selectedRobotsText = document.getElementById('selectedRobotsText');
const mediaList = document.getElementById('mediaList');
const previewArea = document.getElementById('previewArea');
const mediaBox = document.getElementById('mediaBox');
const imagePreview = document.getElementById('imagePreview');
const videoPreview = document.getElementById('videoPreview');
const urlPreview = document.getElementById('urlPreview');
const emptyPreview = document.getElementById('emptyPreview');
const durationSlider = document.getElementById('durationSlider');
const durationLabel = document.getElementById('durationLabel');

// ================== PWA Install Prompt ==================
let deferredPrompt;
const installModal = document.getElementById('installModal');
const installAppBtn = document.getElementById('installAppBtn');
const closeInstallBtn = document.getElementById('closeInstallBtn');
const installMessage = document.getElementById('installMessage');

// كشف نظام iOS
const isIos = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
};
const isInStandaloneMode = () => ('standalone' in window.navigator) && (window.navigator.standalone);

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installMessage.innerText = "قم بتثبيت التطبيق على جهازك للوصول السريع وتجربة أفضل.";
    installAppBtn.style.display = 'block';
    
    // إظهار الرسالة للمستخدم إذا لم يثبته بعد
    if(!localStorage.getItem('installPromptClosed')) {
        installModal.style.display = 'flex';
    }
});

installAppBtn.addEventListener('click', async () => {
    installModal.style.display = 'none';
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        deferredPrompt = null;
    }
});

closeInstallBtn.addEventListener('click', () => {
    installModal.style.display = 'none';
    localStorage.setItem('installPromptClosed', 'true');
});

// ================== تهيئة التطبيق ==================
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(); updateThemeBtnText();
    
    // إذا كان النظام iOS ولم يتم التثبيت
    if (isIos() && !isInStandaloneMode() && !localStorage.getItem('installPromptClosed')) {
        installMessage.innerText = "لتثبيت التطبيق، اضغط على زر المشاركة بالأسفل ثم اختر 'إضافة إلى الصفحة الرئيسية' (Add to Home Screen).";
        installAppBtn.style.display = 'none';
        installModal.style.display = 'flex';
    }

    // SortableJS Drag & Drop
    Sortable.create(mediaList, {
        animation: 150,
        ghostClass: 'media-item-ghost',
        onEnd: function (evt) {
            const itemEl = evt.item;
            const oldIndex = evt.oldIndex;
            const newIndex = evt.newIndex;
            
            const movedItem = selectedMedia.splice(oldIndex, 1)[0];
            selectedMedia.splice(newIndex, 0, movedItem);
            
            if (selectedMediaIndex === oldIndex) selectedMediaIndex = newIndex;
            else if (selectedMediaIndex > oldIndex && selectedMediaIndex <= newIndex) selectedMediaIndex--;
            else if (selectedMediaIndex < oldIndex && selectedMediaIndex >= newIndex) selectedMediaIndex++;
            refreshUI();
        }
    });

    document.getElementById('refreshScreensBtn').onclick = loadScreens;
    
    document.getElementById('addMediaBtn').onclick = () => document.getElementById('fileInput').click();
    document.getElementById('fileInput').onchange = handleFileSelect;
    
    
    
    document.getElementById('sendBtn').onclick = sendToScreens;
    
    durationSlider.oninput = (e) => {
        durationLabel.innerText = e.target.value + 's';
        if (selectedMediaIndex >= 0 && selectedMedia[selectedMediaIndex]) {
            selectedMedia[selectedMediaIndex].durationSeconds = parseInt(e.target.value);
        }
    };
    
    setupLayoutEditor();
    setupAuthAndMenu();

    // Setup Modals
    const screensModal = document.getElementById('screensModal');
    const remoteModal = document.getElementById('remoteModal');
    
    document.getElementById('menuScreensBtn').onclick = () => {
        document.getElementById('sideMenu').classList.remove('open');
        screensModal.style.display = 'flex';
        renderScreensList();
    };
    document.getElementById('saveScreensBtn').onclick = () => {
        screensModal.style.display = 'none';
        // Extract selected
        selectedScreens = [];
        const checkboxes = document.querySelectorAll('.screen-checkbox');
        checkboxes.forEach(cb => {
            if(cb.checked) {
                const sid = cb.getAttribute('data-id');
                const sname = cb.getAttribute('data-name');
                const slast = cb.getAttribute('data-last');
                selectedScreens.push({ id: sid, name: sname, lastBatchId: slast });
            }
        });
    };
    
    document.getElementById('menuRemoteBtn').onclick = () => {
        document.getElementById('sideMenu').classList.remove('open');
        remoteModal.style.display = 'flex';
    };
    document.getElementById('closeRemoteBtn').onclick = () => {
        remoteModal.style.display = 'none';
    };
    
    // Add dynamic theme text update to toggle
    updateThemeBtnText();

});

function applyTheme() {
    if (isDarkMode) document.body.classList.remove('light-theme');
    else document.body.classList.add('light-theme');
}

// ================== نظام المصادقة والإدارة ==================
function setupAuthAndMenu() {
    const loginView = document.getElementById('loginView');
    const appView = document.getElementById('app');
    const adminView = document.getElementById('adminView');
    
    // تسجيل الدخول
    document.getElementById('loginBtn').onclick = async () => {
        const email = document.getElementById('loginEmail').value;
        const pass = document.getElementById('loginPassword').value;
        const err = document.getElementById('loginError');
        try {
            await auth.signInWithEmailAndPassword(email, pass);
        } catch (e) {
            err.style.display = 'block';
            err.innerText = "فشل الدخول: " + e.message;
        }
    };
    
    // إظهار وإخفاء كلمة المرور
    document.getElementById('toggleLoginPass').onclick = function() {
        const p = document.getElementById('loginPassword');
        if(p.type === 'password') { p.type = 'text'; this.innerText = 'إخفاء'; }
        else { p.type = 'password'; this.innerText = 'إظهار'; }
    };
    document.getElementById('toggleNewPass').onclick = function() {
        const p = document.getElementById('newAccPass');
        if(p.type === 'password') { p.type = 'text'; this.innerText = 'إخفاء'; }
        else { p.type = 'password'; this.innerText = 'إظهار'; }
    };
    
    auth.onAuthStateChanged(async user => {
        if (user) {
            loginView.style.display = 'none';
            appView.style.display = 'flex';
            
            // جلب صلاحيات المستخدم
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                currentUserDoc = doc.data();
                if (currentUserDoc.role === 'admin') {
                    document.getElementById('menuAdminBtn').style.display = 'block';
                    
                    
                }
            } else {
                // أول مستخدم يدخل سيكون الأدمن
                currentUserDoc = { role: 'admin', email: user.email, screens: [] };
                await db.collection('users').doc(user.uid).set(currentUserDoc);
                document.getElementById('menuAdminBtn').style.display = 'block';
                
                
            }
            loadScreens();
        } else {
            loginView.style.display = 'flex';
            appView.style.display = 'none';
            adminView.style.display = 'none';
        }
    });

    // القائمة الجانبية
    const sideMenu = document.getElementById('sideMenu');
    document.getElementById('openMenuBtn').onclick = () => sideMenu.classList.toggle('open');
    
    document.getElementById('menuLogoutBtn').onclick = () => { 
        if (confirm("هل أنت متأكد أنك تريد تسجيل الخروج؟")) {
            auth.signOut(); 
            sideMenu.classList.remove('open'); 
        }
    };
    function updateThemeBtnText() {
    const btn = document.getElementById('menuThemeBtn');
    if(btn) btn.innerText = isDarkMode ? "☀️ الوضع النهاري" : "🌙 الوضع الليلي";
}
document.getElementById('menuThemeBtn').onclick = () => {
        isDarkMode = !isDarkMode;
        localStorage.setItem('isDarkMode', isDarkMode);
        applyTheme(); updateThemeBtnText();
        sideMenu.classList.remove('open');
    };
    document.getElementById('menuDeviceNameBtn').onclick = () => {
        const name = prompt("أدخل اسم المرسل (جهازك):", deviceName);
        if (name) { deviceName = name; localStorage.setItem('deviceName', deviceName); }
        sideMenu.classList.remove('open');
    };
    
    // شاشة الأدمن
    document.getElementById('menuAdminBtn').onclick = () => {
        appView.style.display = 'none';
        adminView.style.display = 'flex';
        sideMenu.classList.remove('open');
        loadAdminData();
    };
    document.getElementById('backToAppBtn').onclick = () => {
        adminView.style.display = 'none';
        appView.style.display = 'flex';
        loadScreens(); // تحديث الشاشات بعد الرجوع
    };
    
    // إخفاء الروبوتات المسموحة عند اختيار أدمن
    document.getElementById('newAccRole').addEventListener('change', function() {
        const robotsContainer = document.getElementById('adminRobotsList').parentElement;
        if (this.value === 'admin') {
            robotsContainer.style.display = 'none';
        } else {
            robotsContainer.style.display = 'block';
        }
    });

    // إنشاء حساب جديد
    document.getElementById('createAccBtn').onclick = async () => {
        const email = document.getElementById('newAccEmail').value;
        const pass = document.getElementById('newAccPass').value;
        const msg = document.getElementById('createAccMsg');
        const role = document.getElementById('newAccRole').value;
        
        // الشاشات المحددة
        const checkboxes = document.querySelectorAll('.admin-screen-cb:checked');
        const allowedScreens = Array.from(checkboxes).map(cb => cb.value);
        
        msg.style.color = '#fff'; msg.innerText = "جاري الإنشاء...";
        try {
            const res = await secondaryAuth.createUserWithEmailAndPassword(email, pass);
            await db.collection('users').doc(res.user.uid).set({
                email: email, role: role, screens: allowedScreens, createdBy: auth.currentUser.uid
            });
            await secondaryAuth.signOut();
            msg.style.color = '#00c8be'; msg.innerText = "تم إنشاء الحساب بنجاح!";
            document.getElementById('newAccEmail').value = '';
            document.getElementById('newAccPass').value = '';
            loadAdminData();
        } catch (e) {
            msg.style.color = '#ff4d4d'; msg.innerText = "خطأ: " + e.message;
        }
    };
    
    // أزرار التجميد
    
    
}

async function loadAdminData() {
    const rList = document.getElementById('adminRobotsList');
    rList.innerHTML = 'جاري التحميل...';
    const sSnap = await db.collection('screens').get();
    rList.innerHTML = '';
    sSnap.forEach(doc => {
        const name = doc.data().screenName || doc.id;
        rList.innerHTML += `<label><input type="checkbox" class="admin-screen-cb" value="${doc.id}"> ${name}</label>`;
    });
    
    const uList = document.getElementById('usersList');
    uList.innerHTML = 'جاري التحميل...';
    const uSnap = await db.collection('users').where('createdBy', '==', auth.currentUser.uid).get();
    uList.innerHTML = '';
    uSnap.forEach(doc => {
        const d = doc.data();
        if(d.role === 'admin') return;
        uList.innerHTML += `<div style="padding: 10px; border-bottom: 1px solid var(--border-color);">
            <strong>${d.email}</strong> <span style="color:var(--accent-color); font-size:12px;">(${d.role})</span><br>
            <span style="font-size: 12px; color: var(--text-secondary);">شاشات: ${d.screens ? d.screens.join(', ') : 'لا يوجد'}</span>
        </div>`;
    });
}

// ================== الروبوتات ==================

function loadScreens() {
    if(!currentUserDoc) return;
    db.collection('screens').onSnapshot(async snap => {
        screens = [];
        for (let doc of snap.docs) {
            const sid = doc.id;
            const name = doc.data().screenName || sid;
            if (currentUserDoc && currentUserDoc.role !== 'admin' && currentUserDoc.role !== 'user') {
                if (!currentUserDoc.screens || !currentUserDoc.screens.includes(sid)) continue;
            }
            
            let lastBatchId = null;
            let lastContentText = "فارغ";
            const cSnap = await db.collection("screen_content").where("screenId", "==", sid).orderBy("createdAtDeviceTime", "desc").limit(1).get().catch(e => {
                return db.collection("screen_content").where("screenId", "==", sid).limit(1).get();
            });
            if (!cSnap.empty) {
                const cDoc = cSnap.docs[0].data();
                lastBatchId = cDoc.batchId;
                const mt = cDoc.mediaType;
                const fname = cDoc.originalFileName || "غير معروف";
                lastContentText = يعرض الآن:  ;
            }
            screens.push({ id: sid, name: name, lastBatchId: lastBatchId, lastContentText: lastContentText });
        }
        
        // Ensure previously selected screens remain selected if they still exist
        const oldSelected = selectedScreens.map(s => s.id);
        selectedScreens = screens.filter(s => oldSelected.includes(s.id));
        
        renderScreensList();
    });
}

function renderScreensList() {
    const list = document.getElementById('screensList');
    if(!list) return;
    list.innerHTML = '';
    if(screens.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding: 20px;">لا توجد شاشات متاحة</div>';
        return;
    }
    screens.forEach(s => {
        const isChecked = selectedScreens.some(sel => sel.id === s.id) ? 'checked' : '';
        const div = document.createElement('div');
        div.style.padding = '15px';
        div.style.borderBottom = '1px solid var(--border-color)';
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.gap = '8px';
        
        div.innerHTML = 
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <label style="cursor:pointer; display:flex; align-items:center; gap:10px; font-weight:bold; font-size:16px;">
                    <input type="checkbox" class="screen-checkbox" data-id="" data-name="" data-last=""  style="width:20px; height:20px;">
                    
                </label>
            </div>
            <div style="color: var(--accent-color); font-size: 14px; padding-right: 30px;"></div>
        ;
        list.appendChild(div);
    });
}
function handleFileSelect(e) {
    const files = e.target.files;
    for(let i=0; i<files.length; i++) {
        const file = files[i];
        const isVideo = file.type.startsWith('video/');
        selectedMedia.push({
            file: file,
            name: file.name,
            mimeType: file.type,
            mediaType: isVideo ? 'video' : 'image',
            durationSeconds: isVideo ? 15 : 8,
            url: URL.createObjectURL(file), // Local preview url
            layoutX: 0.0, layoutY: 0.0, layoutW: 1.0, layoutH: 1.0
        });
    }
    selectedMediaIndex = selectedMedia.length - 1;
    refreshUI();
    e.target.value = ''; // Reset
}

function handleAddUrl() {
    let url = document.getElementById('urlInput').value.trim();
    if(url) {
        if(!url.startsWith('http')) url = 'https://' + url;
        selectedMedia.push({
            file: null,
            name: "رابط ويب",
            mimeType: "text/html",
            mediaType: "url",
            durationSeconds: 15,
            url: url,
            layoutX: 0.0, layoutY: 0.0, layoutW: 1.0, layoutH: 1.0
        });
        selectedMediaIndex = selectedMedia.length - 1;
        document.getElementById('urlModal').style.display = 'none';
        document.getElementById('urlInput').value = '';
        refreshUI();
    }
}

function refreshUI() {
    mediaList.innerHTML = '';
    selectedMedia.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'media-item' + (index === selectedMediaIndex ? ' active' : '');
        div.onclick = () => {
            selectedMediaIndex = index;
            refreshUI();
        };
        
        const thumb = document.createElement('div');
        thumb.className = 'media-thumb';
        if (item.mediaType === 'url') {
            thumb.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
        }
        else if (item.mediaType === 'image') thumb.innerHTML = `<img src="${item.url}">`;
        else thumb.innerHTML = `<video src="${item.url}#t=1"></video>`; // t=1 for thumb
        
        const info = document.createElement('div');
        info.className = 'media-info';
        info.innerHTML = `<div class="media-name">${item.name}</div><div class="media-type">${item.mediaType === 'url' ? 'رابط ويب' : (item.mediaType==='image'?'صورة':'فيديو')}</div>`;
        
        const actions = document.createElement('div');
        actions.className = 'media-actions';
        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            selectedMedia.splice(index, 1);
            if(selectedMediaIndex >= selectedMedia.length) selectedMediaIndex = selectedMedia.length - 1;
            refreshUI();
        };
        actions.appendChild(delBtn);
        
        div.appendChild(thumb);
        div.appendChild(info);
        div.appendChild(actions);
        mediaList.appendChild(div);
    });
    
    refreshPreview();
}

function refreshPreview() {
    if (selectedMedia.length === 0 || selectedMediaIndex < 0) {
        mediaBox.style.display = 'none';
        emptyPreview.style.display = 'flex';
        videoPreview.pause();
        return;
    }
    
    const item = selectedMedia[selectedMediaIndex];
    mediaBox.style.display = 'block';
    emptyPreview.style.display = 'none';
    
    // Apply Layout
    const pw = previewArea.clientWidth;
    const ph = previewArea.clientHeight;
    mediaBox.style.left = (item.layoutX * pw) + 'px';
    mediaBox.style.top = (item.layoutY * ph) + 'px';
    mediaBox.style.width = (item.layoutW * pw) + 'px';
    mediaBox.style.height = (item.layoutH * ph) + 'px';
    
    // Set Media
    imagePreview.style.display = 'none';
    videoPreview.style.display = 'none';
    urlPreview.style.display = 'none';
    videoPreview.pause();
    
    if (item.mediaType === 'url') {
        urlPreview.style.display = 'flex';
    } else if (item.mediaType === 'image') {
        imagePreview.style.display = 'block';
        imagePreview.src = item.url;
    } else {
        videoPreview.style.display = 'block';
        videoPreview.src = item.url;
        videoPreview.play();
    }
    
    durationSlider.value = item.durationSeconds;
    durationLabel.innerText = item.durationSeconds + 's';
}

// ================== محرر الأبعاد (Draggable & Resizable) ==================
function setupLayoutEditor() {
    const handle = document.getElementById('resizeHandle');
    let isDragging = false;
    let isResizing = false;
    let startX, startY, startLeft, startTop, startWidth, startHeight;
    
    const getEvt = e => e.touches ? e.touches[0] : e;
    
    // Resize handler
    handle.addEventListener('mousedown', startResize);
    handle.addEventListener('touchstart', startResize, {passive: false});
    
    function startResize(e) {
        e.preventDefault(); e.stopPropagation();
        isResizing = true;
        const evt = getEvt(e);
        startX = evt.clientX; startY = evt.clientY;
        startWidth = mediaBox.offsetWidth; startHeight = mediaBox.offsetHeight;
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopAction);
        document.addEventListener('touchmove', doResize, {passive: false});
        document.addEventListener('touchend', stopAction);
    }
    
    function doResize(e) {
        if (!isResizing) return;
        e.preventDefault();
        const evt = getEvt(e);
        let newWidth = startWidth + (evt.clientX - startX);
        let newHeight = startHeight + (evt.clientY - startY);
        
        // Boundaries limits
        const pw = previewArea.clientWidth; const ph = previewArea.clientHeight;
        const left = mediaBox.offsetLeft; const top = mediaBox.offsetTop;
        if(newWidth + left > pw) newWidth = pw - left;
        if(newHeight + top > ph) newHeight = ph - top;
        if(newWidth < 40) newWidth = 40;
        if(newHeight < 40) newHeight = 40;
        
        mediaBox.style.width = newWidth + 'px';
        mediaBox.style.height = newHeight + 'px';
        saveLayout();
    }
    
    // Drag handler
    mediaBox.addEventListener('mousedown', startDrag);
    mediaBox.addEventListener('touchstart', startDrag, {passive: false});
    
    function startDrag(e) {
        if(e.target === handle) return;
        e.preventDefault();
        isDragging = true;
        const evt = getEvt(e);
        startX = evt.clientX; startY = evt.clientY;
        startLeft = mediaBox.offsetLeft; startTop = mediaBox.offsetTop;
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopAction);
        document.addEventListener('touchmove', doDrag, {passive: false});
        document.addEventListener('touchend', stopAction);
    }
    
    function doDrag(e) {
        if (!isDragging) return;
        e.preventDefault();
        const evt = getEvt(e);
        let newLeft = startLeft + (evt.clientX - startX);
        let newTop = startTop + (evt.clientY - startY);
        
        // Boundaries limits
        const pw = previewArea.clientWidth; const ph = previewArea.clientHeight;
        const w = mediaBox.offsetWidth; const h = mediaBox.offsetHeight;
        if(newLeft < 0) newLeft = 0; if(newTop < 0) newTop = 0;
        if(newLeft + w > pw) newLeft = pw - w;
        if(newTop + h > ph) newTop = ph - h;
        
        mediaBox.style.left = newLeft + 'px';
        mediaBox.style.top = newTop + 'px';
        saveLayout();
    }
    
    function stopAction() {
        isDragging = false; isResizing = false;
        document.removeEventListener('mousemove', doDrag);
        document.removeEventListener('mousemove', doResize);
        document.removeEventListener('mouseup', stopAction);
        document.removeEventListener('touchmove', doDrag);
        document.removeEventListener('touchmove', doResize);
        document.removeEventListener('touchend', stopAction);
    }
    
    function saveLayout() {
        if(selectedMediaIndex >= 0) {
            const item = selectedMedia[selectedMediaIndex];
            const pw = previewArea.clientWidth; const ph = previewArea.clientHeight;
            item.layoutX = mediaBox.offsetLeft / pw;
            item.layoutY = mediaBox.offsetTop / ph;
            item.layoutW = mediaBox.offsetWidth / pw;
            item.layoutH = mediaBox.offsetHeight / ph;
        }
    }
}

// ================== الإرسال إلى الشاشات ==================
async function sendToScreens() {
    if (selectedScreens.length === 0) return alert("الرجاء اختيار روبوت أولاً");
    if (selectedMedia.length === 0) return alert("قم بإضافة وسائط للإرسال");

    if (selectedScreens.length > 1) {
        const firstBatch = selectedScreens[0].lastBatchId;
        const mismatch = selectedScreens.some(s => s.lastBatchId !== firstBatch);
        if (mismatch) {
            const ok = confirm("الشاشات المحددة تعرض حالياً محتويات مختلفة عن بعضها.\nهل أنت متأكد أنك تريد إرسال هذا المحتوى واستبدال كل ما يعرضونه؟");
            if (!ok) return;
        }
    }

    const overlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    overlay.style.display = 'flex';
    
    const batchId = Date.now().toString();
    const batchTotal = selectedMedia.length;
    let done = 0;
    
    loadingText.innerText = `0 / ${batchTotal} جاري المعالجة`;

    try {
        for (let s of selectedScreens) {
            for (let i = 0; i < selectedMedia.length; i++) {
                const item = selectedMedia[i];
                const cid = db.collection('screen_content').doc().id;
                
                if (item.mediaType === 'url') {
                    await db.collection("screen_content").doc(cid).set({
                        screenId: s.id,
                        storagePath: "",
                        mediaType: "url",
                        senderName: deviceName,
                        status: "pending",
                        originalFileName: item.name,
                        durationSeconds: item.durationSeconds,
                        batchId: batchId,
                        batchOrder: i,
                        batchTotal: batchTotal,
                        replacePlaylist: true,
                        createdAtDeviceTime: Date.now(),
                        layoutX: item.layoutX, layoutY: item.layoutY,
                        layoutW: item.layoutW, layoutH: item.layoutH,
                        url: item.url
                    });
                } else {
                    // Upload file
                    const ext = item.name.split('.').pop();
                    const path = `uploads/${s.id}/${cid}.${ext}`;
                    const ref = storage.ref().child(path);
                    
                    const meta = { contentType: item.mimeType || (item.mediaType === 'image'?'image/jpeg':'video/mp4') };
                    await ref.put(item.file, meta);
                    
                    await db.collection("screen_content").doc(cid).set({
                        screenId: s.id,
                        storagePath: path,
                        mediaType: item.mediaType,
                        senderName: deviceName,
                        status: "pending",
                        originalFileName: item.name,
                        durationSeconds: item.durationSeconds,
                        batchId: batchId,
                        batchOrder: i,
                        batchTotal: batchTotal,
                        replacePlaylist: true,
                        createdAtDeviceTime: Date.now(),
                        layoutX: item.layoutX, layoutY: item.layoutY,
                        layoutW: item.layoutW, layoutH: item.layoutH
                    });
                }
                
                done++;
                loadingText.innerText = `${done} / ${batchTotal * selectedScreens.length} تم الإرسال`;
            }
        }
        
        alert("تم إرسال الملفات بنجاح! 🚀");
        // مسح القائمة بعد الإرسال
        selectedMedia = [];
        selectedMediaIndex = -1;
        refreshUI();
        
    } catch (e) {
        console.error(e);
        alert("حدث خطأ أثناء الرفع: " + e.message);
    } finally {
        overlay.style.display = 'none';
    }
}


window.sendCommand = function(cmd) {
    if (typeof selectedScreens === 'undefined' || selectedScreens.length === 0) return alert("الرجاء تحديد شاشة أولاً");
    selectedScreens.forEach(s => {
        db.collection('screens').doc(s.id).set({
            command: cmd,
            cmd_time: Date.now()
        }, { merge: true });
    });
};

document.addEventListener('DOMContentLoaded', () => {
    const volSlider = document.getElementById('volSlider');
    if (volSlider) {
        volSlider.addEventListener('change', function(e) {
            const val = e.target.value;
            document.getElementById('volText').innerText = val + '%';
            window.sendCommand('volume:' + (val / 100));
        });
    }
});
