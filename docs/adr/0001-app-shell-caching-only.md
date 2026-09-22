# The service worker caches the app shell only

Meet4Weed is an installed PWA, and spec §8 says the offline state "renders with
cached feed data". **We are not doing that, and the spec is amended here.** A
cached sesh page holds an exact street address, a unit number and a gate code.
Cache it and that address sits in device storage after the RSVP that unlocked
it is denied, cancelled or kicked — which defeats spec §6.1, the rule the whole
product rests on. The service worker therefore caches the HTML fallback, CSS,
JS, fonts and icons, and nothing that came from the database. Offline shows
"you are offline".

## Consequences

The worker still exists and still runs — web push needs a registered service
worker, not a cache — so install, icons, splash and all seven notification
types are unaffected. What is lost is reading old seshes with no signal. That
was judged a good trade.
