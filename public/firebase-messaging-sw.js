importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyCT34qWD_Jdq5zmLDWpkHLNqPEm4qVhmY4",
    authDomain: "nmtu-5a916.firebaseapp.com",
    projectId: "nmtu-5a916",
    storageBucket: "nmtu-5a916.firebasestorage.app",
    messagingSenderId: "197861340282",
    appId: "1:197861340282:web:13c17b4033974419bf37c3"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received data-only message', payload);

    const data = payload.data || {};

    const notificationTitle = data.title || 'New Message';
    const notificationOptions = {
        body: data.body || '',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        data: {
            url: '/chat'
        }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/dashboard';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];

                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }

            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});