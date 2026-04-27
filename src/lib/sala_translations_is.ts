// =============================================================================
// IDÉ House of Brands — Icelandic UI translations
// =============================================================================
// All UI strings are in Icelandic. The DB columns / enum values stay in English
// (that's what Supabase / Lovable code references). This file is the single
// source of truth — import it anywhere you need a label.
//
// USAGE (in Lovable / any React component):
//   import { t } from '@/lib/translations';
//   <h1>{t.nav.companies}</h1>           // "Viðskiptavinir"
//   <span>{t.dealStage.order_confirmed}</span> // "Staðfest pöntun"
//
// Style decisions locked in:
//   • Tone:  impersonal ("Skrá inn", not "Skráðu þig inn")
//   • Companies are called "Viðskiptavinir" (warmer than "Fyrirtæki")
//   • Decoration techniques stay in English (industry standard)
//   • Brand name: "IDÉ House of Brands"
// =============================================================================

export const t = {

  // ---------------------------------------------------------------------------
  // Brand & app shell
  // ---------------------------------------------------------------------------
  brand: {
    name: 'IDÉ House of Brands',
    short: 'IDÉ',
  },

  // ---------------------------------------------------------------------------
  // Navigation / page titles
  // ---------------------------------------------------------------------------
  nav: {
    dashboard:      'Yfirlit',
    companies:      'Viðskiptavinir',
    contacts:       'Tengiliðir',
    contactSingle:  'Tengiliður',
    contactAcc:     'tengilið',
    deals:          'Sölur',
    dealSingle:     'Sölu',
    designs:        'Hönnun',
    products:       'Vörur',
    quotes:         'Tilboð',
    purchaseOrders: 'Innkaup',
    activities:     'To-Do',
    settings:       'Stillingar',
    users:          'Starfsfólk',
    signOut:        'Skrá út',
  },

  // ---------------------------------------------------------------------------
  // Login screen
  // ---------------------------------------------------------------------------
  login: {
    title:           'Skrá inn í IDÉ House of Brands',
    email:           'Netfang',
    password:        'Lykilorð',
    submit:          'Skrá inn',
    submitting:      'Innskráning í gangi...',
    forgotPassword:  'Gleymdirðu lykilorðinu?',
    wrongCredentials:'Rangt netfang eða lykilorð',
  },

  // ---------------------------------------------------------------------------
  // Enum: deal_stage  (matches the post-migration enum exactly)
  // ---------------------------------------------------------------------------
  dealStage: {
    inquiry:           'Fyrirspurn',
    quote_in_progress: 'Tilboð í vinnslu',
    quote_sent:        'Tilboð sent',
    order_confirmed:   'Staðfest pöntun',
    delivered:         'Pöntun afhent',
    cancelled:         'Hætt við',
    defect_reorder:    'Galli / Vesen',
  },

  // ---------------------------------------------------------------------------
  // Enum: quote_status
  // ---------------------------------------------------------------------------
  quoteStatus: {
    draft:    'Drög',
    sent:     'Sent',
    accepted: 'Samþykkt',
    rejected: 'Hafnað',
    expired:  'Útrunnið',
  },

  // ---------------------------------------------------------------------------
  // Enum: po_status
  // ---------------------------------------------------------------------------
  poStatus: {
    draft:         'Drög',
    sent:          'Sent',
    confirmed:     'Staðfest',
    in_production: 'Í framleiðslu',
    shipped:       'Í flutningi',
    received:      'Móttekið',
    invoiced:      'Rukkað',
    cancelled:     'Hætt við',
  },

  // ---------------------------------------------------------------------------
  // Enum: invoice_status (new from migration v1)
  // ---------------------------------------------------------------------------
  invoiceStatus: {
    not_invoiced: 'Ekki rukkað',
    partial:      'Rukkað að hluta',
    full:         'Rukkað að fullu',
  },

  // ---------------------------------------------------------------------------
  // Enum: payment_status (new from migration v1)
  // ---------------------------------------------------------------------------
  paymentStatus: {
    unpaid:  'Ógreitt',
    partial: 'Greitt að hluta',
    paid:    'Greitt',
  },

  // ---------------------------------------------------------------------------
  // Enum: decoration_technique  — kept in English per Jakob's call
  // ---------------------------------------------------------------------------
  decorationTechnique: {
    screen_print:    'Screen print',
    embroidery:      'Embroidery',
    pad_print:       'Pad print',
    laser_engraving: 'Laser engraving',
    digital_print:   'Digital print',
    transfer:        'Transfer',
    doming:          'Doming',
    sublimation:     'Sublimation',
    uv_print:        'UV print',
    other:           'Annað',
  },

  // ---------------------------------------------------------------------------
  // Enum: activity_type
  // ---------------------------------------------------------------------------
  activityType: {
    note:         'Glósa',
    call:         'Símtal',
    email:        'Tölvupóstur',
    meeting:      'Fundur',
    task:         'Verkefni',
    defect_note:  'Gallafærsla',
    stage_change: 'Stöðubreyting',
  },

  // ---------------------------------------------------------------------------
  // Enum: defect_resolution
  // ---------------------------------------------------------------------------
  defectResolution: {
    pending:     'Í bið',
    reorder:     'Gallapöntun',
    refund:      'Endurgreiðsla',
    credit_note: 'Kreditnóta',
    resolved:    'Leyst',
  },

  // ---------------------------------------------------------------------------
  // Enum: user_role
  // ---------------------------------------------------------------------------
  userRole: {
    admin:    'Stjórnandi',
    sales:    'Sölumaður',
    designer: 'Hönnuður',
    viewer:   'Gestur',
  },

  // ---------------------------------------------------------------------------
  // Enum: vsk_status
  // ---------------------------------------------------------------------------
  vskStatus: {
    standard:      '24% VSK',
    reduced:       '11% VSK',
    export_exempt: '0% VSK – Útflutningur',
    none:          'Án vsk',
  },

  // ---------------------------------------------------------------------------
  // Common buttons & actions
  // ---------------------------------------------------------------------------
  actions: {
    save:      'Vista',
    cancel:    'Hætta við',
    delete:    'Eyða',
    edit:      'Breyta',
    add:       'Bæta við',
    addNew:    'Bæta við nýju',
    create:    'Stofna',
    update:    'Uppfæra',
    submit:    'Senda',
    confirm:   'Staðfesta',
    back:      'Til baka',
    next:      'Áfram',
    close:     'Loka',
    open:      'Opna',
    search:    'Leita',
    filter:    'Sía',
    sort:      'Raða',
    reset:     'Endurstilla',
    refresh:   'Endurhlaða',
    signIn:    'Skrá inn',
    view:      'Skoða',
    download:  'Sækja',
    upload:    'Hlaða upp',
    print:     'Prenta',
    send:      'Senda',
    duplicate: 'Afrita',
    archive:   'Geyma',
    restore:   'Endurheimta',
  },

  // ---------------------------------------------------------------------------
  // Status words & feedback toasts
  // ---------------------------------------------------------------------------
  status: {
    active:               'Virkt',
    inactive:             'Óvirkt',
    archived:             'Geymt',
    required:             'Áskilið',
    optional:             'Valfrjálst',
    yes:                  'Já',
    no:                   'Nei',
    loading:              'Hleður...',
    saving:               'Vistar...',
    saved:                'Vistað',
    savedSuccessfully:    'Vistun tókst',
    error:                'Villa',
    somethingWentWrong:   'Eitthvað fór úrskeiðis',
    noResults:            'Engar niðurstöður',
    noDataYet:            'Engin gögn enn',
    areYouSure:           'Ertu viss?',
    cannotBeUndone:       'Þetta er ekki hægt að afturkalla',
    unsavedChanges:       'Óvistaðar breytingar',
    unsavedChangesBody:   'Þú ert með óvistaðar breytingar. Viltu vista þær eða henda?',
    saveChanges:          'Vista breytingar',
    discardChanges:       'Henda breytingum',
  },

  // ---------------------------------------------------------------------------
  // Time / date words
  // ---------------------------------------------------------------------------
  time: {
    today:      'Í dag',
    yesterday:  'Í gær',
    tomorrow:   'Á morgun',
    thisWeek:   'Í þessari viku',
    lastWeek:   'Í síðustu viku',
    thisMonth:  'Í þessum mánuði',
    date:       'Dagsetning',
    time:       'Tími',
    created:    'Stofnað',
    updated:    'Uppfært',
    due:        'Frestur',
  },

  // ---------------------------------------------------------------------------
  // Field labels — Companies (Viðskiptavinir)
  // ---------------------------------------------------------------------------
  company: {
    name:                'Nafn',
    kennitala:           'Kennitala',
    vsk_number:          'VSK-númer',
    vsk_status:          'VSK-staða',
    email:               'Netfang',
    phone:               'Sími',
    address_line_1:      'Heimilisfang',
    address_line_2:      'Heimilisfang 2',
    postcode:            'Póstnúmer',
    city:                'Staður',
    country:             'Land',
    website:             'Vefsíða',
    notes:               'Athugasemdir',
    preferred_currency:  'Gjaldmiðill',
    payment_terms_days:  'Greiðslufrestur (dagar)',
    payday_customer_id:  'Payday-ID',
    archived:            'Geymt',
    created_at:          'Stofnað',
    updated_at:          'Uppfært',
    created_by:          'Stofnað af',
  },

  // ---------------------------------------------------------------------------
  // Field labels — Contacts (Tengiliðir)
  // ---------------------------------------------------------------------------
  contact: {
    first_name: 'Fornafn',
    last_name:  'Eftirnafn',
    title:      'Starfsheiti',
    email:      'Netfang',
    phone:      'Sími',
    is_primary: 'Aðaltengiliður',
    notes:      'Athugasemdir',
  },

  // ---------------------------------------------------------------------------
  // Field labels — Deals (Sölur)
  // ---------------------------------------------------------------------------
  deal: {
    so_number:               'Sölunúmer',
    name:                    'Heiti',
    stage:                   'Staða',
    amount_isk:              'Upphæð án vsk',
    promised_delivery_date:  'Áætluð afhending',
    estimated_delivery_date: 'Áætluð afhending',
    actual_close_date:       'Raunveruleg lokadagsetning',
    tracking_numbers:        'Tracking númer',
    margin_isk:              'Framlegð',
    invoice_status:          'Reikningsstaða',
    payment_status:          'Greiðslustaða',
    invoice_date:            'Reikningsdagsetning',
    amount_invoiced_isk:     'Upphæð rukkuð',
    amount_paid_isk:         'Upphæð greidd',
    paid_at:                 'Greitt þann',
    payday_invoice_number:   'Payday-reikningsnúmer',
    owner_id:                'Söluaðili',
    notes:                   'Athugasemdir',
    default_markup_pct:      'Sjálfgefið álag (%)',
    shipping_cost_isk:       'Sendingarkostnaður (ISK)',
    total_cost_isk:          'Heildarkostnaður',
    total_price_isk:          'Heildarverð',
    total_margin_isk:         'Heildarmunur',
    defect_description:       'Lýsing á vanda',
    defect_resolution:        'Staða máls',
    parent_deal:              'Tengd upphafleg sala',
    defectModal: {
      title:       'Lýstu vandanum',
      placeholder: 'Lýstu vandanum sem kom upp...',
      required:    'Nauðsynlegt að fylla út lýsingu',
      confirm:     'Staðfesta og færa í Galli / Vesen',
      cancel:      'Hætta við',
    },
  },

  // ---------------------------------------------------------------------------
  // Field labels — Deal lines (Línur)
  // ---------------------------------------------------------------------------
  dealLine: {
    title:                'Línur',
    addLine:              'Bæta við línu',
    product_name:         'Vara',
    product_supplier_sku: 'Vörunúmer (birgir)',
    description:          'Lýsing',
    quantity:             'Magn',
    unit_cost:            'Innk.verð',
    cost_currency:        'Gjaldmiðill',
    exchange_rate:        'Gengi',
    unit_cost_isk:        'Innkaupsverð (ISK)',
    markup_pct:           'Álagning',
    unit_price_isk:       'Per stk',
    line_cost_isk:        'Heildarkostnaður línu',
    line_total_isk:       'Samtals',
    line_margin_isk:      'Framlegð línu',
    notes:                'Athugasemdir',
    exchangeRateBar:      'Gengi í dag',
    roundedNote:          'Verð hefur verið sléttað',
    marginLabel:          'Framlegð',
    shippingCost:         'Sendingarkostnaður (kostnaður)',
    shippingNote:         'Sendingarkostnaður er ekki reiknaður inn í söluverð — hann lækkar framlegð.',
    defaultMarkup:        'Sjálfgefin álagning',
    applyToAll:           'Nota á allar línur',
  },

  // ---------------------------------------------------------------------------
  // Deal summary footer labels
  // ---------------------------------------------------------------------------
  dealSummary: {
    subtotal:    'Söluverð án vsk',
    totalCost:   'Kostnaðarverð',
    shipping:    'Sendingarkostnaður (ef við á)',
    totalMargin: 'Framlegð',
    marginPct:   'Framlegð %',
    vat:         'VSK',
    grandTotal:  'Söluverð með vsk',
  },

  // ---------------------------------------------------------------------------
  // Field labels — Designs (Hönnun)
  // ---------------------------------------------------------------------------
  design: {
    name:                 'Heiti',
    artwork_file_path:    'Hönnunarskrá',
    thumbnail_url:        'Smámynd',
    first_used_deal_id:   'Fyrst notað í',
    tags:                 'Merkingar',
    notes:                'Athugasemdir',
  },

  // ---------------------------------------------------------------------------
  // Field labels — Decoration specs
  // ---------------------------------------------------------------------------
  decorationSpec: {
    product_category: 'Vöruflokkur',
    technique:        'Aðferð',
    placement:        'Staðsetning',
    max_colors:       'Hámarksfjöldi lita',
    size_mm_w:        'Breidd (mm)',
    size_mm_h:        'Hæð (mm)',
    pantone_colors:   'Pantone-litir',
    notes:            'Athugasemdir',
  },

  // ---------------------------------------------------------------------------
  // Field labels — Quotes (Tilboð)
  // ---------------------------------------------------------------------------
  quote: {
    version:           'Útgáfa',
    status:            'Staða',
    valid_until:       'Gildir til',
    terms:             'Skilmálar',
    subtotal_isk:      'Samtals án vsk',
    shipping_cost_isk: 'Sendingarkostnaður',
    vat_isk:           'VSK',
    total_isk:         'Samtals',
    pdf_url:           'PDF-skjal',
    sent_at:           'Sent (dagsetning)',
    viewed_at:         'Skoðað (dagsetning)',
  },

  // ---------------------------------------------------------------------------
  // Field labels — Quote lines
  // ---------------------------------------------------------------------------
  quoteLine: {
    line_order:           '#',
    product_name:         'Vöruheiti',
    product_supplier_sku: 'Vörunúmer (birgir)',
    description:          'Lýsing',
    quantity:             'Magn',
    unit_price_isk:       'Einingarverð',
    unit_cost_eur:        'Innkaupsverð (EUR)',
    vsk_rate:             'VSK-prósenta',
    line_total_isk:       'Línusumma',
  },

  // ---------------------------------------------------------------------------
  // Field labels — Purchase orders (Innkaupapantanir)
  // ---------------------------------------------------------------------------
  purchaseOrder: {
    po_number:               'Pöntunarnúmer',
    supplier:                'Birgir',
    supplier_reference:      'Tilvísun birgis',
    currency:                'Gjaldmiðill',
    amount:                  'Upphæð',
    shipping_cost:           'Sendingarkostnaður',
    expected_delivery_date:  'Áætluð afhending',
    actual_delivery_date:    'Raunveruleg afhending',
    notes:                   'Athugasemdir',
  },

  // ---------------------------------------------------------------------------
  // Field labels — PO lines
  // ---------------------------------------------------------------------------
  poLine: {
    supplier_sku:          'Vörunúmer birgis',
    description:           'Lýsing',
    quantity:              'Fjöldi',
    unit_cost:             'Einingarverð',
    line_total:            'Línusumma',
    linked_quote_line_id:  'Tengt við tilboðslínu',
  },

  // ---------------------------------------------------------------------------
  // Field labels — Activities
  // ---------------------------------------------------------------------------
  activity: {
    type:         'Tegund',
    subject:      'Heiti',
    body:         'Lýsing',
    due_date:     'Frestur',
    completed:    'Lokið',
    completed_at: 'Lokið (dagsetning)',
  },

  // ---------------------------------------------------------------------------
  // Log feed (deal detail)
  // ---------------------------------------------------------------------------
  log: {
    title:           'Log',
    placeholder:     'Skráðu athugasemd...',
    send:            'Senda',
    stageChanged:    'Sala færð í',
    by:              '·',
    noEntries:       'Engar færslur enn',
    comment:         'Athugasemd',
    defectEntry:     'Gallafærsla',
  },

} as const;


// =============================================================================
// Number / date formatting helpers — Icelandic conventions
// =============================================================================
//   Currency:   1.250,00 kr.    (. for thousands, , for decimal, kr. suffix)
//   Date:       22.04.2026      (dd.mm.yyyy)
//   Date long:  22. apríl 2026  (for prose, quote PDFs)
//   Time:       14:30           (24-hour)
//   Phone:      +354 555 0123
// =============================================================================

export const formatIsk = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return '';
  // Format: "123.456 kr." — dot as thousands separator, "kr." suffix.
  // Manually inserting dots to be locale-data independent.
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded).toString();
  const withDots = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${withDots} kr.`;
};

export const formatNumber = (n: number | null | undefined, decimals = 2): string => {
  if (n === null || n === undefined) return '';
  return new Intl.NumberFormat('is-IS', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
};

export const formatDate = (d: Date | string | null | undefined): string => {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
};

export const formatDateLong = (d: Date | string | null | undefined): string => {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('is-IS', {
    day:   'numeric',
    month: 'long',
    year:  'numeric',
  }).format(date);
};

export const formatTime = (d: Date | string | null | undefined): string => {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('is-IS', {
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};


// =============================================================================
// Type export — lets TypeScript autocomplete every translation key
// =============================================================================
export type Translations = typeof t;
