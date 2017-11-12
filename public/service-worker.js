importScripts('workbox-sw.prod.v2.1.1.js');
importScripts('/src/js/idb.js')
importScripts('/src/js/utility.js')

const workboxSW = new self.WorkboxSW();

workboxSW.router.registerRoute(/.*(?:googleapis|gstatic)\.com.*$/, workboxSW.strategies.staleWhileRevalidate({
    cacheName: 'google-fonts',
    cacheExpiration: {
        maxEntries: 3,
        maxAgeSeconds: 60 * 60 * 24 * 30
    }
}));

workboxSW.router.registerRoute('https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css', workboxSW.strategies.staleWhileRevalidate({
    cacheName: 'materials-css'
}));

workboxSW.router.registerRoute(/.*(?:firebasestorage\.googleapis|gstatic)\.com.*$/, workboxSW.strategies.staleWhileRevalidate({
    cacheName: 'image-posts'
}));

workboxSW.router.registerRoute('https://pwagram-2f213.firebaseio.com/posts.json', function (args) {
    return fetch(args.event.request).then(function (res) {
        var cloneRes = res.clone();
        clearAllData('posts').then(function () {
            return cloneRes.json()
        }).then(function (data) {
            for (var key in data) {
                writeData('posts', data[key])
            }
        });
        return res;
    });
});

workboxSW.router.registerRoute(function (routeData) {
    return (routeData.event.request.headers.get('accept').includes('text/html'));
}, function (args) {
    return caches.match(args.event.request)
        .then(function (response) {
            if (response) {
                return response;
            } else {
                return fetch(args.event.request)
                    .then(function (res) {
                        return caches.open('dynamic')
                            .then(function (cache) {
                                cache.put(args.event.request.url, res.clone());
                                return res;
                            })
                    });
            }
        })
        .catch(function (err) {
            return caches.match('/offline.html').then(function (res) {
                return res;
            });
        });
});

workboxSW.precache([
  {
    "url": "favicon.ico",
    "revision": "2cab47d9e04d664d93c8d91aec59e812"
  },
  {
    "url": "index.html",
    "revision": "c2310079215ad713e2f4424a9fa79c4e"
  },
  {
    "url": "manifest.json",
    "revision": "4a7c43274bfc43c519d20f18950472bb"
  },
  {
    "url": "offline.html",
    "revision": "28f61f51ff8710887e4786b82b0ce29a"
  },
  {
    "url": "src/css/app.css",
    "revision": "f27b4d5a6a99f7b6ed6d06f6583b73fa"
  },
  {
    "url": "src/css/feed.css",
    "revision": "5177bc43b9ab5bd872ab513b0590dcbc"
  },
  {
    "url": "src/css/help.css",
    "revision": "1c6d81b27c9d423bece9869b07a7bd73"
  },
  {
    "url": "src/images/main-image-lg.jpg",
    "revision": "31b19bffae4ea13ca0f2178ddb639403"
  },
  {
    "url": "src/images/main-image-sm.jpg",
    "revision": "c6bb733c2f39c60e3c139f814d2d14bb"
  },
  {
    "url": "src/images/main-image.jpg",
    "revision": "5c66d091b0dc200e8e89e56c589821fb"
  },
  {
    "url": "src/images/sf-boat.jpg",
    "revision": "0f282d64b0fb306daf12050e812d6a19"
  },
  {
    "url": "src/js/app.min.js",
    "revision": "fa29c8cfd9bdeb85349debfd98bcc60e"
  },
  {
    "url": "src/js/feed.min.js",
    "revision": "07f65bf577f4b66470945f51116f7cd9"
  },
  {
    "url": "src/js/fetch.min.js",
    "revision": "a3d051e37ea10d8d5c7ae77aedaa87e9"
  },
  {
    "url": "src/js/idb.min.js",
    "revision": "b2ac265af44e1bf2c224c0283d5ccdfb"
  },
  {
    "url": "src/js/material.min.js",
    "revision": "713af0c6ce93dbbce2f00bf0a98d0541"
  },
  {
    "url": "src/js/promise.min.js",
    "revision": "9bbe6503bbed57e8d4992e0a174d3305"
  },
  {
    "url": "src/js/utility.min.js",
    "revision": "49a30a3b306d86ac4d16245197ae0e5d"
  }
]);

self.addEventListener('sync', function (event) {
    console.log('[Service Worker] Background syncing', event)
    if (event.tag === 'sync-new-posts') {
        console.log('[Service Worker] Syncing new Posts')
        event.waitUntil(
            readAllData('sync-posts').then(function (data) {
                for(var dt of data){
                    var postData = new FormData();
                    postData.append('id',dt.id);
                    postData.append('title',dt.title);
                    postData.append('location',dt.location);
                    postData.append('rawLocationLat',dt.rawLocation.lat);
                    postData.append('rawLocationLng',dt.rawLocation.lng);
                    postData.append('file',dt.picture,dt.id+'.png');
                    fetch('https://us-central1-pwagram-2f213.cloudfunctions.net/storePostData',{
                        method: 'POST',
                        body: postData
                    }).then(function (res) {
                        console.log('Send data', res)
                        if (res.ok) {
                            deleteItemFromDatabase('sync-posts', dt.id);
                        }
                    }).catch(function (err) {
                        console.log('Error while sending data', err)
                    })
                }
            })
        )
    }
});

self.addEventListener('notificationclick', function (event) {
    var notification = event.notification;
    var action = event.action;
    if (action === 'confirm'){
        console.log('Confirm was chosen');
        notification.close();
    } else {
        console.log(action);
        event.waitUntil(
            clients.matchAll().then(function (clis) {
                var client = clis.find(function (c) {
                    return c.visibilityState === 'visible'
                });

                if(client !== undefined){
                    client.navigate(notification.data.url)
                    client.focus()
                } else {
                    clients.openWindow(notification.data.url)
                }
                notification.close()
            })
        )
        notification.close();
    }
})

self.addEventListener('notificationclose', function (event) {
    console.log('Notification was closed', event)
})

self.addEventListener('push',function (event) {
    console.log('Push Notification received', event)
    var data = {title: 'New!',content: 'Something new happened!',openUrl:'/'}
    if (event.data) {
        data = JSON.parse(event.data.text());
    }

    var options = {
        body: data.content,
        icon: '/src/images/icons/app-icon-96x96.png',
        badge: '/src/images/icons/app-icon-96x96.png',
        data: {
            url: data.openUrl
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    )
})