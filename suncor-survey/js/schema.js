/*
 * Field schema for Suncor_Site_Survey_v1.1.
 *
 * Every field's `label` is the exact start of its line in the Word template, so the
 * filler (docx-fill.js) can find it. Field types:
 *   text    one-line answer written over the underscores on the label's line
 *   long    answer written on the two underscore lines under the label
 *   choice  tick one ☐ on the line under the label (opts must match the template)
 *   parts   several small inputs joined into one answer ("H: 36 in / W: 48 in")
 *   idline  "SiteID / ZoneID[ / area]" built automatically
 *   photos  filled only from captured photo IDs
 * Optional keys:
 *   photos: [shotKeys]  captured photo IDs are appended to the answer
 *   unit: true          measurements: warn when no unit is given, offer "approx."
 *   hint                guidance shown under the field (install-guide facts etc.)
 *   when(a)             field applies only when this returns true; otherwise "N/A"
 *   note                choice values that need a written reason/detail
 */
(function () {
  var YNU = ['Yes', 'No', 'Unable to verify'];
  var YNUNA = ['Yes', 'No', 'Unable to verify', 'N/A'];
  var VIAB = ['Viable', 'Viable with work', 'Not viable', 'Unable to verify'];
  var MOUNT_REUSE = ['Likely', 'No', 'Unable to verify', 'N/A'];
  var MATERIAL = ['Steel studs', 'Wood', 'Steel joists', 'Concrete', 'Other', 'Unable to verify'];
  var VIEW = ['Clear', 'Partly obscured', 'Poor', 'Unable to verify'];
  var NOTE_DEFAULT = ['Unable to verify', 'Other'];

  function yes(a, k) { return a[k] && a[k].v === 'Yes'; }

  // Shots: key, short filename description, label, checklist category, required?
  var SHOTS = {
    site: [
      { k: 'Exterior', d: 'Exterior', label: 'Storefront exterior', cat: 'site', req: true },
      { k: 'StoreID', d: 'StoreID', label: 'Address / store # signage', cat: 'site', req: true },
      { k: 'EntryView', d: 'EntryView', label: 'Wide interior view from entrance', cat: 'site', req: true },
      { k: 'Other', d: 'Other', label: 'Other site context', cat: 'site', req: false }
    ],
    display: [
      { k: 'Wide', d: 'Wide', label: 'Wide contextual view', cat: 'dwide', req: true },
      { k: 'Sightline', d: 'Sightline', label: 'Sightline from entrance / queue', cat: 'dwide', req: true },
      { k: 'Label', d: 'Label', label: 'Model / serial label (sharp close-up)', cat: 'ddetail', req: true },
      { k: 'PoweredOn', d: 'PoweredOn', label: 'Screen powered on', cat: 'ddetail', req: true },
      { k: 'Defects', d: 'Defects', label: 'Defects (if any)', cat: 'ddetail', req: false },
      { k: 'Mount', d: 'Mount', label: 'Mount / attachment points', cat: 'ddetail', req: true },
      { k: 'Inputs', d: 'Inputs', label: 'Input panel (HDMI / LAN ports)', cat: 'ddetail', req: true },
      { k: 'Outlet', d: 'Outlet', label: 'Power outlet', cat: 'ddetail', req: true },
      { k: 'Behind', d: 'Behind', label: 'Space behind display', cat: 'ddetail', req: true },
      { k: 'CableRoute', d: 'CableRoute', label: 'Cable route / ceiling path', cat: 'cable', req: true },
      { k: 'Other', d: 'Other', label: 'Other', cat: 'ddetail', req: false }
    ],
    cash: [
      { k: 'CounterFront', d: 'Counter', label: 'Counter front', cat: 'cash', req: true },
      { k: 'QueueView', d: 'QueueView', label: 'Customer queue / payment view', cat: 'cash', req: true },
      { k: 'EntranceView', d: 'EntranceView', label: 'View from store entrance', cat: 'cash', req: true },
      { k: 'Ceiling', d: 'Ceiling', label: 'Ceiling / structure (tile lifted)', cat: 'cash', req: true },
      { k: 'Security', d: 'Security', label: 'Security monitors / cameras', cat: 'cash', req: true },
      { k: 'Measure', d: 'Measure', label: 'Measurements (tape in frame)', cat: 'cash', req: false },
      { k: 'Outlet', d: 'Outlet', label: 'Power outlet / power drop', cat: 'cash', req: true },
      { k: 'CableRoute', d: 'CableRoute', label: 'Cable path / ceiling access', cat: 'cable', req: true },
      { k: 'Other', d: 'Other', label: 'Other', cat: 'cash', req: false }
    ],
    endcap: [
      { k: 'EntranceView', d: 'EntranceView', label: 'View from main entrance', cat: 'endcap', req: true },
      { k: 'FixtureFront', d: 'Fixture', label: 'Fixture front', cat: 'endcap', req: true },
      { k: 'FixtureSide', d: 'FixtureSide', label: 'Fixture side / measurements', cat: 'endcap', req: true },
      { k: 'Ceiling', d: 'Ceiling', label: 'Ceiling / support point (tile lifted)', cat: 'endcap', req: true },
      { k: 'Obstacles', d: 'Obstacles', label: 'Obstacles (signage, CCTV, lights)', cat: 'endcap', req: true },
      { k: 'Outlet', d: 'Outlet', label: 'Nearest outlet', cat: 'endcap', req: true },
      { k: 'CableRoute', d: 'CableRoute', label: 'Cable route', cat: 'cable', req: true },
      { k: 'Other', d: 'Other', label: 'Other', cat: 'endcap', req: false }
    ],
    room: [
      { k: 'Overview', d: 'Overview', label: 'Room overview', cat: 'room', req: true },
      { k: 'Rack', d: 'Rack', label: 'Existing rack / cabinet', cat: 'room', req: true },
      { k: 'MX67Port5', d: 'MX67Port5', label: 'Meraki MX67 close-up (Port 5)', cat: 'room', req: true },
      { k: 'NetworkGear', d: 'NetworkGear', label: 'Other active network gear', cat: 'room', req: true },
      { k: 'Power', d: 'Power', label: 'Outlet / breaker panel', cat: 'room', req: true },
      { k: 'WallSpace', d: 'WallSpace', label: 'Unoccupied wall / rack space', cat: 'room', req: true },
      { k: 'SpeedTest', d: 'SpeedTest', label: 'Internet test result (screenshot)', cat: 'room', req: false },
      { k: 'CablePath', d: 'CablePath', label: 'Cable pathway out of room', cat: 'cable', req: true },
      { k: 'Other', d: 'Other', label: 'Other', cat: 'room', req: false }
    ]
  };

  var SITE_FIELDS = [
    { id: 'tech', row: 'Technician name', label: 'Technician name', type: 'text' },
    { id: 'siteId', row: 'Location number / Site ID', label: 'Location number / Site ID', type: 'text', hint: 'Used in every photo filename. Letters, digits and dashes only.' },
    { id: 'address', row: 'Site address', label: 'Site address', type: 'text' },
    { id: 'date', row: 'Survey date', label: 'Survey date', type: 'date' },
    { id: 'contact', row: 'Site contact', label: 'Site contact / phone / email', type: 'parts', parts: [
      { k: 'name', label: 'Name' }, { k: 'phone', label: 'Phone', input: 'tel' }, { k: 'email', label: 'Email', input: 'email' }], bare: true },
    { id: 'displays', row: 'Displays on site', label: 'Displays on site / surveyed / not surveyed', type: 'displays',
      hint: 'Surveyed count comes from the display records you add.' }
  ];

  var DISPLAY = [
    { part: 1, id: 'idline', label: 'Site ID / Display ID / current area on plan', type: 'idline', area: true },
    { part: 1, id: 'area', label: 'Current area on plan', type: 'area', ui: true, placeholder: 'e.g., wall above coffee bar' },
    { part: 1, id: 'make', label: 'Manufacturer / exact model / serial number', type: 'text',
      hint: 'Tip: open the Label photo and use Live Text / Google Lens to copy the model and serial instead of typing.' },
    { part: 1, id: 'labelPhoto', label: 'Label photograph filename or photo ID', type: 'photos', photos: ['Label'] },
    { part: 1, id: 'size', label: 'Diagonal size / units / measured or label-sourced', type: 'text', unit: true, placeholder: '55 in (label)' },
    { part: 1, id: 'orient', label: 'Display orientation', type: 'choice', opts: ['Landscape', 'Portrait', 'Other', 'Unable to verify'] },
    { part: 1, id: 'content', label: 'Current content / source owner / intended current use', type: 'text' },
    { part: 1, id: 'powered', label: 'Display powered on and operating at time of visit', type: 'choice', opts: YNU },
    { part: 1, id: 'condition', label: 'Display condition / defects', type: 'long', placeholder: 'image, damage, burn-in, colour, flicker… or "No visible defects"' },
    { part: 1, id: 'mountMethod', label: 'Mounting method', type: 'choice', opts: ['Wall', 'Ceiling', 'Suspended', 'Stand', 'Other', 'Unable to verify'] },
    { part: 1, id: 'mountDetail', label: 'Mount model / attachment points / visible condition / photo ID', type: 'text', photos: ['Mount'] },
    { part: 1, id: 'heights', label: 'Finished floor to BOTTOM of screen / to CENTRE / units', type: 'parts', unit: true, parts: [
      { k: 'bottom', label: 'Bottom' }, { k: 'centre', label: 'Centre' }] },
    { part: 1, id: 'view', label: 'View of display from customer entrance, cash queue or main traffic path', type: 'choice', opts: VIEW },
    { part: 1, id: 'obstruct', label: 'Glare, fixtures, merchandise, security displays or other viewing obstructions', type: 'long' },
    { part: 1, id: 'widePhotos', label: 'Wide-angle location / viewing-angle photo IDs', type: 'photos', photos: ['Wide', 'Sightline'] },

    { part: 2, id: 'idline2', label: 'Site ID / Display ID', type: 'idline' },
    { part: 2, id: 'hdmi', label: 'HDMI input physically present', type: 'choice', opts: YNU,
      hint: 'CDM guide: the player feeds HDMI 1, and screens need a LAN port for remote monitoring.' },
    { part: 2, id: 'hdmiPorts', label: 'HDMI ports: total / free / occupied / inaccessible', type: 'parts', parts: [
      { k: 'total', label: 'Total', input: 'number' }, { k: 'free', label: 'Free', input: 'number' },
      { k: 'occupied', label: 'Occupied', input: 'number' }, { k: 'inacc', label: 'Inaccessible', input: 'number' }] },
    { part: 2, id: 'otherPorts', label: 'Other available ports and labels', type: 'text', placeholder: 'RJ45 LAN, RS-232C, USB, DP…' },
    { part: 2, id: 'source', label: 'Selected input / connected source device', type: 'text' },
    { part: 2, id: 'menu', label: 'Input selection or on-screen menu accessible', type: 'choice', opts: YNU },
    { part: 2, id: 'remote', label: 'Remote control available? / who controls source and access?', type: 'text' },
    { part: 2, id: 'outlet', label: 'Power outlet available at display', type: 'choice', opts: YNU },
    { part: 2, id: 'spareOutlet', label: 'Spare outlet available for CRI player', type: 'choice', opts: YNU },
    { part: 2, id: 'constant', label: 'Constant power confirmed, not switched with lighting', type: 'choice', opts: YNU,
      hint: 'Confirm by method (e.g. outlet tester with lighting switched off), and say how in the next field.' },
    { part: 2, id: 'powerDetail', label: 'Power source, distance, confirmation method / photo ID', type: 'text', photos: ['Outlet'] },
    { part: 2, id: 'behind', label: 'Space and acceptable fixing surface BEHIND display for local player', type: 'choice', opts: YNU },
    { part: 2, id: 'localMount', label: 'Proposed local mounting location / access / photo ID', type: 'text', photos: ['Behind'] },
    { part: 2, id: 'route100', label: 'If player is in rack/electrical room: accessible cable route of 100 ft or less?', type: 'choice', opts: YNUNA },
    { part: 2, id: 'routeDetail', label: 'Estimated actual pathway length / barriers / photo ID', type: 'text', unit: true, photos: ['CableRoute'] },
    { part: 2, id: 'disconnect', label: 'Existing equipment can be disconnected/repositioned without known ownership conflict?', type: 'choice', opts: YNU },
    { part: 2, id: 'followup', label: 'Known site restrictions or follow-up required', type: 'text' }
  ];

  var CASH = [
    { part: 1, id: 'idline', label: 'Site ID / Cash Zone candidate ID (C01, etc.) / area on plan', type: 'idline', area: true },
    { part: 1, id: 'area', label: 'Area on plan', type: 'area', ui: true, placeholder: 'e.g., main cash counter, ceiling above POS' },
    { part: 1, id: 'practical', label: 'Is a practical cash-zone display location identifiable?', type: 'choice', opts: YNU },
    { part: 1, id: 'approach', label: 'Candidate position / installation approach', type: 'choice', opts: ['Ceiling suspended', 'Counter-facing wall', 'Back wall behind clerk', 'Other'] },
    { part: 1, id: 'bulkhead', label: 'Bulkhead configuration', type: 'choice', opts: ['None', 'Circular / halo', 'Other', 'Unable to verify'] },
    { part: 1, id: 'floorCeil', label: 'Floor to suspended/drop ceiling', type: 'text', unit: true, placeholder: '9 ft 6 in' },
    { part: 1, id: 'counterCeil', label: 'Counter surface to drop ceiling', type: 'text', unit: true },
    { part: 1, id: 'floorDeck', label: 'Floor to load-bearing structure above ceiling', type: 'text', unit: true, hint: 'Lift a tile; measure to the deck / joist the mount would hang from.' },
    { part: 1, id: 'counterDims', label: 'Counter height / width / depth', type: 'parts', unit: true, parts: [
      { k: 'h', label: 'H' }, { k: 'w', label: 'W' }, { k: 'd', label: 'D' }] },
    { part: 1, id: 'clear', label: 'Available clear width × height above or behind counter', type: 'parts', unit: true, parts: [
      { k: 'w', label: 'W' }, { k: 'h', label: 'H' }] },
    { part: 1, id: 'bottom', label: 'Possible screen bottom height above finished floor', type: 'text', unit: true,
      hint: 'CDM guide: cash-zone screens ~82 in (6.8 ft) floor to bottom, aligned with the bottom of the security monitors. Survey legacy note: ~7 ft.' },
    { part: 1, id: 'align', label: 'Does the candidate position align with the counter and customer sightlines?', type: 'choice', opts: ['Yes', 'No', 'Partially', 'Unable to verify'] },
    { part: 1, id: 'viewDesc', label: 'Describe view from store entrance, queue and payment position', type: 'long' },
    { part: 1, id: 'construction', label: 'Ceiling / wall construction at possible mounting point', type: 'choice', opts: MATERIAL },
    { part: 1, id: 'restrict', label: 'Any known structural/mounting restrictions', type: 'choice', opts: YNU },
    { part: 1, id: 'restrictDetail', label: 'Restrictions, support location, construction details and possible remedy', type: 'long' },

    { part: 2, id: 'idline2', label: 'Site ID / Cash Zone candidate ID', type: 'idline' },
    { part: 2, id: 'fits', label: 'Can an existing site display fit without obstructing retail operations or customers?', type: 'choice', opts: YNU },
    { part: 2, id: 'maxSize', label: 'Maximum usable display size / clear width × height / obstructions', type: 'text', unit: true },
    { part: 2, id: 'secMon', label: 'Would existing security monitors require relocation?', type: 'choice', opts: YNU },
    { part: 2, id: 'secCam', label: 'Would a relocated screen obstruct security cameras', type: 'choice', opts: YNU },
    { part: 2, id: 'secSolution', label: 'If yes, which security device needs changing / potential solution?', type: 'text',
      when: function (a) { return yes(a, 'secMon') || yes(a, 'secCam'); } },
    { part: 2, id: 'headroom', label: 'Does installation interfere with customer headroom or cashier view?', type: 'choice', opts: YNU },
    { part: 2, id: 'powerNear', label: 'Suitable power near intended display location', type: 'choice', opts: YNU },
    { part: 2, id: 'spare', label: 'Spare continuous-power outlet for player available', type: 'choice', opts: YNU },
    { part: 2, id: 'outletDetail', label: 'Power outlet location / estimated distance / photo ID', type: 'text', unit: true, photos: ['Outlet'] },
    { part: 2, id: 'lv', label: 'Accessible network / HDMI / low-voltage pathway to proposed position', type: 'choice', opts: YNU },
    { part: 2, id: 'route', label: 'Estimated cable-route length (ft) / route / access restrictions', type: 'text', unit: true, photos: ['CableRoute'] },
    { part: 2, id: 'mountReuse', label: 'Existing mount reusable at this location?', type: 'choice', opts: MOUNT_REUSE },
    { part: 2, id: 'mountWork', label: 'Mount, extension, anchoring or construction work likely required', type: 'text' },
    { part: 2, id: 'viability', label: 'Physical viability of this candidate zone', type: 'choice', opts: VIAB },
    { part: 2, id: 'concerns', label: 'Key concerns / specific reasons if not viable', type: 'long' },
    { part: 2, id: 'photoIds', label: 'Required overview, ceiling, counter and customer-view photo IDs', type: 'photos', photos: '*' }
  ];

  var ENDCAP = [
    { part: 1, id: 'idline', label: 'Site ID / End-cap candidate ID (E01, etc.) / area on plan', type: 'idline', area: true },
    { part: 1, id: 'area', label: 'Area on plan', type: 'area', ui: true, placeholder: 'e.g., aisle 2 end, facing entrance' },
    { part: 1, id: 'aisle', label: 'Aisle number / nearby fixture / orientation facing entrance', type: 'text' },
    { part: 1, id: 'plausible', label: 'Is at least one plausible end-cap installation location identifiable?', type: 'choice', opts: YNU },
    { part: 1, id: 'fixture', label: 'Fixture height × width × depth / units', type: 'parts', unit: true, parts: [
      { k: 'h', label: 'H' }, { k: 'w', label: 'W' }, { k: 'd', label: 'D' }] },
    { part: 1, id: 'distance', label: 'Distance from main customer entrance to proposed screen', type: 'text', unit: true },
    { part: 1, id: 'usable', label: 'Usable width / height above product fixture', type: 'parts', unit: true, parts: [
      { k: 'w', label: 'W' }, { k: 'h', label: 'H' }] },
    { part: 1, id: 'bottom', label: 'Proposed bottom edge of screen above product / floor', type: 'parts', unit: true, parts: [
      { k: 'prod', label: 'Above product' }, { k: 'floor', label: 'Above floor' }],
      hint: 'CDM guide: end-cap screen ~6 in above merchandise (survey legacy: at least 2–3 in).' },
    { part: 1, id: 'view', label: 'View from entrance and normal customer flow', type: 'choice', opts: VIEW },
    { part: 1, id: 'obscure', label: 'Would a display obscure products, promotions, other signage or security monitors?', type: 'choice', opts: YNU },
    { part: 1, id: 'merch', label: 'Any merchandise / shelf repositioning needed / dimensions', type: 'text' },
    { part: 1, id: 'better', label: 'Are other end caps better suited?', type: 'choice', opts: YNU },
    { part: 1, id: 'alt', label: 'If yes, alternative ID / location / reason', type: 'text', when: function (a) { return yes(a, 'better'); } },
    { part: 1, id: 'installType', label: 'Proposed installation type', type: 'choice', opts: ['Above end cap, ceiling mounted', 'Wall mounted', 'Fixture mounted (subject to design)', 'Other'] },
    { part: 1, id: 'clearance', label: 'Is there minimum workable clearance above products?', type: 'choice', opts: YNU },
    { part: 1, id: 'support', label: 'Mounting support material', type: 'choice', opts: MATERIAL },

    { part: 2, id: 'idline2', label: 'Site ID / End-cap candidate ID', type: 'idline' },
    { part: 2, id: 'ceilAccess', label: 'Ceiling / mounting access available for visual inspection', type: 'choice', opts: YNU },
    { part: 2, id: 'restrict', label: 'Mounting restrictions (ductwork, lights, sprinklers, conduit, structural members)?', type: 'choice', opts: YNU },
    { part: 2, id: 'structure', label: 'Describe mounting structure, obstructions and potential solution', type: 'long' },
    { part: 2, id: 'pole', label: 'Extension pole or custom bracket likely required', type: 'choice', opts: YNU },
    { part: 2, id: 'drop', label: 'Ceiling-to-support and expected drop / extension requirements', type: 'text', unit: true },
    { part: 2, id: 'mountReuse', label: 'Existing screen mounting system could be reused', type: 'choice', opts: MOUNT_REUSE },
    { part: 2, id: 'outlet', label: 'Electrical outlet near preferred end-cap location', type: 'choice', opts: YNU },
    { part: 2, id: 'spare', label: 'Spare constant-power outlet for media player', type: 'choice', opts: YNU },
    { part: 2, id: 'outletDetail', label: 'Outlet location / distance / electrical work required / photo ID', type: 'text', unit: true, photos: ['Outlet'] },
    { part: 2, id: 'pathway', label: 'Practical cable pathway to existing source or back-of-house room', type: 'choice', opts: YNU },
    { part: 2, id: 'route', label: 'Estimated cable-run length / pathway / ceiling access concerns', type: 'text', unit: true, photos: ['CableRoute'] },
    { part: 2, id: 'cctv', label: 'Security monitor or CCTV relocation necessary', type: 'choice', opts: YNU },
    { part: 2, id: 'viability', label: 'Physical viability of candidate zone', type: 'choice', opts: VIAB },
    { part: 2, id: 'challenges', label: 'Challenges, work items or reason location is unsuitable', type: 'long' },
    { part: 2, id: 'photoIds', label: 'Entrance-view, fixture, ceiling, outlet and cable-route photo IDs', type: 'photos', photos: '*' }
  ];

  var ROOM = [
    { part: 1, id: 'idline', label: 'Site ID / Room ID (ER01, etc.) / location on plan', type: 'idline', area: true },
    { part: 1, id: 'area', label: 'Location on plan', type: 'area', ui: true, placeholder: 'e.g., back office, north wall' },
    { part: 1, id: 'accessible', label: 'Room accessible for survey', type: 'choice', opts: YNU },
    { part: 1, id: 'access', label: 'Access contact / escort / key or service-window restrictions', type: 'text',
      hint: 'CDM guide: the Suncor network cabinet is locked; the code comes from Suncor/CDM (may default to the 3 digits of the store number).' },
    { part: 1, id: 'rack', label: 'Existing rack/cabinet present', type: 'choice', opts: YNU },
    { part: 1, id: 'rackDetail', label: 'Rack owner / dimensions / verified available rack units', type: 'text', photos: ['Rack'] },
    { part: 1, id: 'wall', label: 'Unoccupied wall area (W×H), surface, clearance / photo ID', type: 'text', unit: true, photos: ['WallSpace'],
      hint: 'CDM guide: nothing goes in the Suncor rack; the CDM rack is installed separately, as close to it as possible.' },
    { part: 1, id: 'fits', label: 'Can a separate equipment cabinet/rack physically fit here?', type: 'choice', opts: YNU },
    { part: 1, id: 'power', label: 'Usable, continuous power available for player / rack', type: 'choice', opts: YNU },
    { part: 1, id: 'powerDetail', label: 'Outlet / breaker / available power observations / photo ID', type: 'text', photos: ['Power'] },
    { part: 1, id: 'mx67', label: 'Site Meraki MX67 firewall present?', type: 'choice', opts: YNU },
    { part: 1, id: 'port5', label: 'If MX67 is present, is port 5 available?', type: 'choice', opts: YNUNA,
      hint: 'CDM uses Port 5 on the Suncor MX67 (Telus managed). Look only; do not unplug anything.' },
    { part: 1, id: 'otherGear', label: 'Other ports / active network equipment / network owner / photo ID', type: 'text', photos: ['MX67Port5', 'NetworkGear'] },
    { part: 1, id: 'approved', label: 'Suitable approved network/internet access for CRI player verified', type: 'choice', opts: YNU },
    { part: 1, id: 'test', label: 'Network connection tested for internet access', type: 'choicetext', opts: ['Pass', 'Fail', 'Not tested'],
      parts: [{ k: 'port', label: 'Port' }, { k: 'method', label: 'Method' }, { k: 'down', label: 'Down Mbps', input: 'number' }, { k: 'up', label: 'Up Mbps', input: 'number' }],
      photos: ['SpeedTest'], hint: 'Only with site approval. CDM minimum: 25 Mbps down / 5 Mbps up.' },
    { part: 1, id: 'pathD', label: 'Existing displays D__', type: 'text', unit: true, relabel: 'D', placeholder: 'D01: ~60 ft via ceiling, fire wall at…' },
    { part: 1, id: 'pathC', label: 'Cash zone C__', type: 'text', unit: true, relabel: 'C' },
    { part: 1, id: 'pathE', label: 'End cap E__', type: 'text', unit: true, relabel: 'E' },
    { part: 1, id: 'lvNonIntrusive', label: 'Can required low-voltage routes be accessed without intrusive work?', type: 'choice', opts: YNU }
  ];

  var FEAS = [
    { id: 'remain', label: 'Does any existing display appear technically suitable to remain in its current location?', type: 'choice', opts: YNU },
    { id: 'remainWhy', label: 'Which display IDs / why?', type: 'text' },
    { id: 'betterZones', label: 'Which, if any, candidate zones have better physical customer visibility?', type: 'long' },
    { id: 'constraints', label: 'Major relocation constraints', type: 'long', placeholder: 'ownership, service disruption, bracket, power, network, mount, product clearance' }
  ];

  // Section 6 photo checklist rows: text the row contains -> shot category
  var CHECKLIST = [
    { cat: 'site', text: 'Site exterior / location identification', label: 'Site exterior + marked floor plan' },
    { cat: 'dwide', text: 'Each existing display: wide contextual view', label: 'Displays: wide view + sightline' },
    { cat: 'ddetail', text: 'Each display: model/serial label', label: 'Displays: label, power, mount, inputs, outlet' },
    { cat: 'cash', text: 'Cash zone: counter front', label: 'Cash zone photos' },
    { cat: 'endcap', text: 'End cap: view from entrance', label: 'End-cap photos' },
    { cat: 'room', text: 'Room: rack, active network gear', label: 'Room: rack, network, power, space' },
    { cat: 'cable', text: 'Cable paths, ceiling access', label: 'Cable paths / ceiling access' }
  ];

  var SIGNOFF = [
    { id: 'folder', label: 'Photo folder / marked plan filename / missing IDs and reason', type: 'auto' },
    { id: 'qcDisplays', label: 'All existing displays recorded and IDs match marked plan', type: 'auto' },
    { id: 'qcCash', label: 'Cash zone assessed, including feasibility and photo evidence', type: 'auto' },
    { id: 'qcEnd', label: 'End-cap zone assessed, including feasibility and photo evidence', type: 'auto' },
    { id: 'qcBoth', label: 'Both alternative zones assessed even if current locations were adequate', type: 'auto' },
    { id: 'qcRoom', label: 'Electrical / network room and photo evidence documented', type: 'auto' },
    { id: 'outstanding', label: 'Outstanding verification items / affected IDs / next action', type: 'long' },
    { id: 'observations', label: 'Overall site observations and installation obstacles', type: 'long' },
    { id: 'signature', label: 'Technician name / signature (typed accepted) / date', type: 'auto' }
  ];

  var KINDS = {
    display: { prefix: 'D', name: 'Existing display', fields: DISPLAY, shots: SHOTS.display,
      headings: ['1 | Existing Display Record — Part 1 of 2', '1 | Existing Display Record — Part 2 of 2'] },
    cash: { prefix: 'C', name: 'Cash zone', fields: CASH, shots: SHOTS.cash,
      headings: ['2 | Cash Zone Assessment — Part 1 of 2', '2 | Cash Zone Assessment — Part 2 of 2'] },
    endcap: { prefix: 'E', name: 'End cap', fields: ENDCAP, shots: SHOTS.endcap,
      headings: ['3 | End-Cap Assessment — Part 1 of 2', '3 | End-Cap Assessment — Part 2 of 2'] },
    room: { prefix: 'ER', name: 'Equipment / network room', fields: ROOM, shots: SHOTS.room,
      headings: ['4 | Equipment, Electrical Room & Network Assessment'] }
  };

  window.SURVEY = {
    version: 'Suncor_Site_Survey_v1.1',
    KINDS: KINDS, SITE_FIELDS: SITE_FIELDS, SITE_SHOTS: SHOTS.site, FEAS: FEAS, SIGNOFF: SIGNOFF, CHECKLIST: CHECKLIST,
    NOTE_DEFAULT: NOTE_DEFAULT,
    HEADINGS: { feas: '5 | Display-to-Zone Feasibility Comparison', signoff: '6 | Photo Checklist, Information Gaps & Sign-Off', appendix: 'Appendix A' }
  };
})();
