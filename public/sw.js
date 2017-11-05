

importScripts('/src/js/idb.js')
importScripts('/src/js/utility.js')

var STATIC_NAME = 'static-v32';
var DYNAMIC_NAME = 'dynamic-v3';
var STATIC_FILE = [
    '/',
    '/index.html',
    '/offline.html',
    '/src/js/app.js',
    '/src/js/feed.js',
    '/src/js/idb.js',
    '/src/js/promise.js',
    '/src/js/utility.js',
    '/src/js/fetch.js',
    '/src/js/material.min.js',
    '/src/css/app.css',
    '/src/css/feed.css',
    '/src/images/main-image.jpg',
    'https://fonts.googleapis.com/css?family=Roboto:400,700',
    'https://fonts.googleapis.com/icon?family=Material+Icons',
    'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css'
]

function trimCache(cacheName, maxItems) {
    caches.open(cacheName).then(function (cache) {
        return cache.keys().then(function (keys) {
            if (keys.length > maxItems) {
                cache.delete(keys[0]).then(trimCache(cacheName,maxItems))
            }
        })
    })
}

function isInArray(string, array) {
    var cachePath;
    if (string.indexOf(self.origin) === 0) { // request targets domain where we serve the page from (i.e. NOT a CDN)
        console.log('matched ', string);
        cachePath = string.substring(self.origin.length); // take the part of the URL AFTER the domain (e.g. after localhost:8080)
    } else {
        cachePath = string; // store the full request (for CDNs)
    }
    return array.indexOf(cachePath) > -1;
}

self.addEventListener('install', function (event) {
    console.log('[Service Worker] Installing Service Worker ...', event);
    event.waitUntil(
        caches.open(STATIC_NAME).then(function (cache) {
            console.log('[Service Worker] Precaching App Shell');
            cache.addAll(STATIC_FILE);
        })
    )
});

self.addEventListener('activate', function (event) {
    console.log('[Service Worker] Activating Service Worker ...', event);
    event.waitUntil(
        caches.keys().then(function (keyList) {
            return Promise.all(keyList.map(function (key) {
                if (key !==STATIC_NAME&& key !== DYNAMIC_NAME) {
                    console.log('[Service Worker] Removing old cache. ',key);
                    return caches.delete(key);
                }
            }));
        })
    )
    return self.clients.claim();
});

//Cache then network with offline support
self.addEventListener('fetch', function (event) {
    var url = 'https://pwagram-2f213.firebaseio.com/posts.json'
    if (event.request.url.indexOf(url) > -1) {
        event.respondWith(
            caches.open(DYNAMIC_NAME)
                .then(function (cache) {
                    return fetch(event.request).then(function (res) {
                        var cloneRes = res.clone();
                        clearAllData('posts').then(function () {
                            return cloneRes.json()
                        }).then(function (data) {
                            for (var key in data) {
                                writeData('posts',data[key])
                            }
                        })
                        return res;
                    });
                })
        )
    }
    else if (isInArray(event.request.url,STATIC_FILE)){
        event.respondWith(
            caches.match(event.request)
        )
    }
    else {
        event.respondWith(
            caches.match(event.request)
                .then(function (response) {
                    if (response){
                        console.log('fetch from caches success')
                        return response;
                    } else {
                        console.log('fetch from caches unsuccess')
                        return fetch(event.request)
                            .then(function (res) {
                                return caches.open(DYNAMIC_NAME)
                                    .then(function (cache) {
                                        cache.put(event.request.url, res.clone());
                                        return res;
                                    })
                            });
                    }
                })
                .catch(function (err) {
                    return caches.open(STATIC_NAME).then(function (cache) {
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return cache.match('/offline.html');
                        }
                    })
                })
        )
    }

});

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

// Cache, network fall back with routing
/*self.addEventListener('fetch', function (event) {
   event.respondWith(
       caches.match(event.request)
           .then(function (response) {
             if (response){
                 console.log('fetch from caches success')
                 return response;
             } else {
                 console.log('fetch from caches unsuccess')
                 return fetch(event.request)
                     .then(function (res) {
                         return caches.open(DYNAMIC_NAME)
                             .then(function (cache) {
                                 cache.put(event.request.url, res.clone());
                                 return res;
                             })
                     });
             }
           })
           .catch(function (err) {
               return caches.open(STATIC_NAME).then(function (cache) {
                   return cache.match('/offline.html');
               })
           })
   )
});*/

// Network,caches fallback
// self.addEventListener('fetch', function (event) {
//    event.respondWith(
//        fetch(event.request).then(function (res) {
//            return caches.open(DYNAMIC_NAME)
//                .then(function (cache) {
//                    cache.put(event.request.url, res.clone());
//                    return res;
//                })
//        }).catch(function (err) {
//            return caches.match(event.request)
//        })
//    )
// });

// Cache only
// self.addEventListener('fetch', function (event) {
//    event.respondWith(
//        caches.match(event.request)
//    )
// });

// Network only
// self.addEventListener('fetch', function (event) {
//    event.respondWith(
//        fetch(event.request)
//    )
// });

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