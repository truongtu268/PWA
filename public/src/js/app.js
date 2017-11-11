var deferredPrompt;
var enableNotificationBtuton = document.querySelectorAll('.enable-notifications')

if(!window.Promise) {
    window.Promise = Promise
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').then(function () {
        console.log('service worker registered!');
    }).catch(function (err) {
        console.log(err);
    });
}

window.addEventListener('beforeinstallprompt',function (event) {
    console.log('beforeinstallprompt fired');
    event.preventDefault();
    deferredPrompt = event;
    return false;
});

function displayConfirmNotification() {
    if('serviceWorker' in navigator) {
        var options = {
            body: 'You successfully subscribed to our Notification service!',
            icon: '/src/images/icons/app-icon-96x96.png',
            image: '/src/images/sf-boat.jpg',
            dir: 'ltr',
            lang: 'en-US',
            vibrate: [100, 50, 200],
            badge: '/src/images/icons/app-icon-96x96.png',
            tag: 'confirm-notification',
            renotify: true,
            actions: [
                {action: 'confirm', title: 'Okay', icon:'/src/images/icons/app-icon-96x96.png'},
                {action: 'cancel', title: 'Cancel', icon:'/src/images/icons/app-icon-96x96.png'}
            ]
        };
        navigator.serviceWorker.ready.then(function (swreg) {
            swreg.showNotification('Successfully subscribed!', options);
        })
    }
}

function configurePushSub() {
    if(!('serviceWorker' in navigator)) {
        return;
    }
    var reg;
    navigator.serviceWorker.ready.then(function (swreg) {
        reg = swreg;
        return swreg.pushManager.getSubscription();
    }).then(function (sub) {
        if (sub === null) {
            // Create a new subscription
            var vapidPublicKey = 'BMvmruiBLYPcqkzA2utM7kX9hQH_l_k2bM9auxi6Hwlno_maip9ZQk6S2WVdo5tZQK4FDRVk_oyvyOwUjtvIP0g';
            var convertedVapidPublicKey = urlBase64ToUint8Array(vapidPublicKey);
            return reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidPublicKey
            });
        } else {
            // We have a subscription
        }
    }).then(function(newSub) {
        return fetch('https://pwagram-2f213.firebaseio.com/subscriptions.json', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(newSub)
        })
    })
        .then(function(res) {
            if (res.ok) {
                displayConfirmNotification();
            }
        })
        .catch(function(err) {
            console.log(err);
        });
}

function askNotificationPermission() {
    Notification.requestPermission(function (result) {
        console.log('User Choice', result);
        if (result!== 'granted') {
            console.log('No notification permission granted');
        } else {
            configurePushSub();
        }
    })
}

if ('Notification' in window && 'serviceWorker' in navigator) {
    for (var i = 0; i< enableNotificationBtuton.length; i++){
        enableNotificationBtuton[i].style.display = 'inline-block';
        enableNotificationBtuton[i].addEventListener('click', askNotificationPermission)
    }
}