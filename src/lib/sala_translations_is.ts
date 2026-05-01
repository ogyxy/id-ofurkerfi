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
    ready_for_pickup:  'Tilbúið til afhendingar',
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
    ordered:    'Pantað',
    received:   'Móttekið',
    invoiced:   'Reikningur',
    paid:       'Greitt',
    cancelled:  'Hætt við',
  },

  // ---------------------------------------------------------------------------
  // Enum: invoice_status (new from migration v1)
  // ---------------------------------------------------------------------------
  invoiceStatus: {
    not_invoiced: 'Ekki rukkað',
    partial:      'Rukkað að hluta',
    full:         'Rukkað',
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
    refund:      'Endurgreiðsla / afsláttur',
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
    showLess:  'Sýna minna',
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
  // New customer drawer
  // ---------------------------------------------------------------------------
  newCompany: {
    title:               'Nýr viðskiptavinur',
    companySection:      'Fyrirtæki',
    contactSection:      'Tengiliður',
    contactRecommended:  'Mælt er með að skrá tengilið. Það auðveldar samskipti og söluskráningu.',
    skipContact:         'Sleppa þessu skrefi',
    contactSkipped:      'Tengilið verður sleppt',
    contactSkippedHint:  'Þú getur bætt við tengilið síðar á síðu fyrirtækisins.',
    warnNoContact:       'Þú hefur ekki skráð tengilið. Viltu vista án tengiliðar?',
    saveAnyway:          'Vista samt',
    addContactAnyway:    'Bæta við tengilið samt',
    advancedDetails:     'Ítarlegar upplýsingar',
    nameRequired:        'Nafn er nauðsynlegt',
    firstNameRequired:   'Fornafn er nauðsynlegt',
    billedVia:           'Reikningsfærð á',
    linkedCustomers:     'Tengdir viðskiptavinir',
    billedViaSearch:     'Leita að fyrirtæki…',
    billedViaNone:       'Ekkert',
    invoiceSentTo:       'Reikningur sendur á',
    invoiceTo:           'Reikningur á',
  },

  // ---------------------------------------------------------------------------
  // Field labels — Deals (Sölur)
  // ---------------------------------------------------------------------------
  deal: {
    so_number:               'Sölunúmer',
    name:                    'Heiti',
    stage:                   'Staða',
    amount_isk:              'Upphæð án vsk',
    promised_delivery_date:  'Deadline',
    estimated_delivery_date: 'Áætluð móttaka',
    actual_close_date:       'Raunveruleg lokadagsetning',
    tracking_numbers:        'Tracking númer',
    trackingPickPo:                 'Hvaða PO?',
    trackingNoPoYet:                'Stofnaðu PO áður en tracking númer er bætt við.',
    trackingDuplicate:              'Tracking númer er þegar skráð á {po}',
    confirmAllPosArrivedTitle:      'Eru allar pantanir komnar í hús?',
    confirmAllPosArrivedBody:       '{count} PO eru skráðar á þessa sölu. Ef aðeins hluti þeirra eru kominn, merktu það í Innkaupum.',
    confirmAllPosArrivedConfirm:    'Allar pantanir komnar',
    notDelivered:            'Deadline',
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
    default_markup_pct:      'Sjálfgefin álagning (%)',
    shipping_cost_isk:       'Sendingarkostnaður (ISK)',
    total_cost_isk:          'Heildarkostnaður',
    total_price_isk:          'Heildarverð',
    total_margin_isk:         'Heildarmunur',
    defect_description:       'Lýsing á vanda',
    defect_resolution:        'Staða máls',
    refund_amount_isk:        'Endurgreiðsla / afsláttur (ISK)',
    refundNote:               'Upphæðin er dregin frá heildartekjum og framlegð.',
    netAmount:                'Nettóupphæð',
    defectResolved:           'Mál lokið',
    defectLinked:             'Tengd gallapöntun',
    defectReorderDelivered:   'Gallapöntun afhent',
    parent_deal:              'Tengd upphafleg sala',
    searchPlaceholder:        'Leita að sölu, vöru, fyrirtæki, tracking númeri, PO...',
    filterAll:                'Virkar',
    noDeals:                  'Engar sölur fundust',
    estimatedDelivery:        'Áætluð afhending',
    deliveredOn:              'Afhent',
    selectCustomer:           'Velja viðskiptavin',
    searchCustomerPlaceholder:'Leita að viðskiptavini...',
    newCustomer:              '+ Nýr viðskiptavinur',
    newContact:               '+ Nýr tengiliður',
    selectContact:            'Velja tengilið',
    searchContactPlaceholder: 'Leita að tengilið...',
    total:                    'Samtals',
    filterOpen:               'Opnar',
    filterDelivered:          'Afhentar',
    filterDefect:             'Galli / Vesen',
    filterCancelled:          'Hætt við',
    newCustomerSaving:        'Stofnar viðskiptavin...',
    firstNoteLabel:           'Fyrsta athugasemd (Log)',
    firstNotePlaceholder:     'Skráðu athugasemd sem mun birtast í Log...',
    moveToStage:              'Færa í',
    defectMoveHint:           'Til að færa í Galli/Vesen, opnaðu söluna',
    owner:                    'Söluaðili',
    createTitle:              'Stofna sölu',
    createButton:             '+ Stofna sölu',
    clearFilters:             'Hreinsa síur',
    searchingAll:             'Leitar í öllum sölum...',
    allOwners:                'Allar',
    unassignOwner:            'Taka af',
    yearFilter:               'Ár',
    addContact:               'Bæta við tengilið',
    amountTooltipNotInvoiced: 'Ekki rukkað — pöntun afhent en reikningur hefur ekki verið gefinn út',
    amountTooltipUnpaid:      'Ógreitt — reikningur hefur verið gefinn út en greiðsla hefur ekki borist',
    step1Tilbod:              'Tilboð',
    step2Pontun:              'Pöntun',
    step3Afhent:              'Afhent',
    substepSent:              'Sent',
    substepInHouse:           'Komin í hús',
    markAsSent:               'Tilboð sent',
    markAsSentConfirm:        "Þegar tilboð er sett í 'sent' verða sölulínur læstar. Halda áfram?",
    markAsSentConfirmYes:     'Já, senda',
    reactivateQuote:          'Lagfæra tilboð',
    confirmOrder:             'Staðfesta pöntun',
    markGoodsArrived:         'Vörur komnar í hús',
    revertGoodsArrived:       'Skila í pöntunarstöðu',
    markAsDelivered:          'Merkja sem afhent',
    inquiryStepperNote:       'Á fyrirspurnarstigi',
    defectModal: {
      title:       'Lýstu vandanum',
      placeholder: 'Lýstu vandanum sem kom upp...',
      required:    'Nauðsynlegt að fylla út lýsingu',
      confirm:     'Staðfesta og færa í Galli / Vesen',
      cancel:      'Hætta við',
    },
    quoteBuilder:           'Útbúa tilboð',
    quoteBuilderTitle:      'Útbúa tilboð',
    quoteSent:              'Tilboð sent',
    quoteRefine:            'Lagfæra tilboð',
    quoteValidUntil:        'Gildir til',
    quoteNote:              'Athugasemd',
    quoteNotePlaceholder:   'Sérstök athugasemd á tilboð (valkvætt)',
    quoteAttachments:       'Bæta við skjölum (PDF og myndir)',
    quoteNoAttachments:     'Engin PDF eða myndaskjöl tengd þessari sölu.',
    quoteNoLines:           'Sala hefur engar línur — bættu við vörulínum áður en tilboð er búið til.',
    quoteGenerateButton:    'Búa til og hlaða niður',
    quoteSuccess:           'Tilboð búið til og vistað',
    quoteAttachSkipped:     'Ekki tókst að bæta við',
    quoteUploadFailed:      'Villa við vistun — skrá hlaðin niður staðbundið',
    quoteRegenNote:         'Tilboð endurgert',
    quotePreviewTitle:      'Forskoðun',
    quoteSettingsTitle:     'Stillingar',
    quoteCustomer:          'Viðskiptavinur',
    quoteLineCount:         'Fjöldi vörulína',
    quoteTotalExVat:        'Samtals án VSK',
    quoteCancel:            'Hætta við',
    quoteRefineRevert:      'Lagfæra tilboð',
    soCopiedToast:          'Sölunúmer afritað',
    confirmNoContactTitle:  'Engin tengiliður skráður',
    confirmNoContactBody:   'Ertu viss um að þú viljir ekki stofna nýjan tengilið?',
    confirmNoContactYes:    'Já, halda áfram',
    confirmNoContactNo:     'Bæta við tengilið',
    addNewContact:          '+ Nýr tengiliður',
    supplierRefAdd:         '+ Bæta við tilvísun birgis',
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
    title:                   'Innkaup',
    pageTitle:               'Innkaup',
    create:                  'Stofna PO',
    createFromDeal:          'Bæta við PO',
    manageSuppliers:         'Stjórna birgjum',
    searchPlaceholder:       'Leita að PO, birgi, tilvísun...',
    noOrders:                'Engin innkaupapöntun fundin',
    noOrdersOnDeal:          'Engar innkaupapantanir tengdar',

    po_number:               'PO númer',
    supplier:                'Birgir',
    supplier_reference:      'Tilvísun birgis',
    status:                  'Staða',
    linked_deal:             'Tengd sala',
    currency:                'Gjaldmiðill',
    exchange_rate:           'Gengi',
    amount:                  'Upphæð',
    shipping_cost:           'Sendingarkostnaður',
    total_amount:            'Heildarupphæð',
    amount_isk:              'Upphæð (ISK)',
    shipping_cost_isk:       'Sendingarkostnaður (ISK)',

    order_date:              'Pöntunardagur',
    orderedShort:            'Pantað',
    expected_delivery_date:  'Áætluð móttaka',
    received_date:           'Móttekið',
    proof_received_date:     'Print proof móttekið',

    invoiceSection:          'Reikningur birgis',
    supplier_invoice_number: 'Reikningsnúmer',
    supplier_invoice_amount: 'Reikningsupphæð',
    invoice_received_date:   'Reikningur dagsettur',
    paid_date:               'Greitt',

    filesSection:            'Skjöl',
    uploadFile:              'Hlaða upp skjali',
    fileType:                'Tegund',
    fileTypeProof:           'Print proof',
    fileTypeOrderConfirm:    'Pöntunarstaðfesting',
    fileTypeInvoice:         'Reikningur',
    fileTypeArtwork:         'Hönnun',
    fileTypeOther:           'Annað',
    noFiles:                 'Engin skjöl enn',
    dropHere:                'Dragðu skrá hingað eða smelltu',

    notes:                   'Athugasemdir',
    cancelPO:                'Hætta við PO',
    reactivatePO:            'Endurvirkja',
    cancelled:               'Hætt við',

    // 3-step stepper (Pantað → Móttekið → Greitt)
    step1Pantad:             'Pantað',
    step2Mottekid:           'Móttekið',
    step3Greitt:             'Greitt',
    pillEnRoute:             'Á leiðinni',
    pillInvoicePending:      'Reikningur bíður samþykkis',
    pillInvoiceApproved:     'Reikningur samþykktur',
    actionGoodsArrived:      'Vörur komnar í hús',
    actionRegisterInvoice:   'Skrá reikning frá birgi',
    actionApproveInvoice:    'Samþykkja reikning',
    actionEditInvoice:       'Breyta reikningi',
    actionMarkPaid:          'Merkja sem greitt',
    actionRevertApproval:    'Afturkalla samþykki reiknings',
    actionRevertPayment:     'Afturkalla greiðslu',
    actionRevertToOrdered:   'Skila í pöntunarstöðu',
    paidBanner:              'Greitt þann {date}',
    editInvoiceWarning:      'Reikningur er samþykktur. Breytingar krefjast endursamþykkis.',
    confirmRevertInvoiceData:'Þetta mun hreinsa reikningsupplýsingar. Halda áfram?',
    registeredBy:            'Skráð af',
    approvedBy:              'Samþykkt af',
    invoiceFile:             'Reikningsskjal',
    noInvoiceFile:           'Ekkert skjal',
    invoiceDrawerTitle:      'Skrá reikning frá birgi',
    invoiceDrawerEditTitle:  'Breyta reikningi',
    invoiceUploadFile:       'Reikningsskjal (PDF)',
    invoiceAmountInOriginal: 'Reikningsupphæð',
    invoiceReceivedDateLabel:'Dagsetning reiknings',
    invoiceNumberLabel:      'Reikningsnúmer',
    confirmMarkPaid:         'Skrá greiðslu',
    pickPaymentDate:         'Veldu greiðsludag',
    requireDealHelp:         'Sala er nauðsynleg fyrir innkaupapöntun',
    suppliersFilterLabel:    'Birgjar',
    statusFilterLabel:       'Staða',
    selectSupplier:          'Veldu birgi',
    selectDeal:              'Veldu sölu',
    noDeal:                  'Engin tengd sala',
    editLinkedDeal:          'Breyta',
    createTitle:             'Stofna PO',
    newSupplierInline:       '+ Nýr birgir',
    deleteFileConfirm:       'Eyða skjali?',
    uploadedBy:              'Hlaðið upp af',
    awaitingOtherPos:               'Bíður eftir {count} öðrum pöntunum áður en sala færist í Komin í hús.',
    revertPoFromDeliveredSoTitle:   'Salan er merkt sem afhent',
    revertPoFromDeliveredSoBody:    'Halda áfram að skila þessum PO í pöntunarstöðu án þess að breyta sölunni?',
    cascadeReceivedNote:            'Móttekið sjálfvirkt þegar sala var merkt komin í hús',
    trackingSectionTitle:           'Tracking',
    trackingAddButton:              '+ Bæta við tracking númer',
    coreFieldsEditTitle:            'Breyta innkaupapöntun',
    orderConfirmationUpload:        'Pöntunarstaðfesting (PDF)',
    orderConfirmationOptional:      'Valfrjálst',
  },

  supplier: {
    title:           'Birgjar',
    addNew:          'Bæta við birgi',
    addNewInline:    'Nýr birgir',
    name:            'Nafn',
    default_currency:'Sjálfgefinn gjaldmiðill',
    website:         'Vefsíða',
    contact_email:   'Netfang',
    notes:           'Athugasemdir',
    active:          'Virkur',
    noSuppliers:     'Engir birgjar skráðir',
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

  // ---------------------------------------------------------------------------
  // Deal files (Skjöl tengd sölu)
  // ---------------------------------------------------------------------------
  dealFile: {
    title:             'Skjöl',
    upload:            'Hlaða upp skjali',
    noFiles:           'Engin skjöl enn',
    fileType:          'Tegund',
    size:              'Stærð',
    uploadedBy:        'Hlaðið upp af',
    uploadedAt:        'Dagsetning',
    download:          'Sækja',
    delete:            'Eyða',
    confirmDelete:     'Eyða þessu skjali?',
    confirmYes:        'Já, eyða',
    uploading:         'Hleður upp...',
    uploadFailed:      'Ekki tókst að hlaða upp',
    pickFile:          'Veldu skrá',
    dropHere:          'Dragðu skrá hingað eða smelltu',
    filterAll:         'Allar',
    noFilesForFilter:  'Engin skjöl af þessari tegund',
    clearFilter:       'Hreinsa síu',
    emptyHint:         'Skjöl bætast hér við þegar þeim er hlaðið upp í sölurnar.',
    linkedDeal:        'Tengd sala',
  },

  // ---------------------------------------------------------------------------
  // Company files (Vörumerki / brand assets)
  // ---------------------------------------------------------------------------
  companyFile: {
    sectionTitle: 'Vörumerki',
    sectionHint:  'Skjöl sem tilheyra fyrirtækinu sjálfu — merki, vörumerkjastefna, letur o.fl.',
    upload:       'Hlaða upp brand-skjali',
    noFiles:      'Engin brand-skjöl enn',
    emptyHint:    'Hlaðið upp lógói, vörumerkjastefnu eða öðrum brand-skjölum hér.',
  },

  // ---------------------------------------------------------------------------
  // Deal files section title (on the company Skjöl tab)
  // ---------------------------------------------------------------------------
  dealFilesSection: {
    sectionTitle: 'Skjöl úr sölum',
    sectionHint:  'Skjöl sem hafa verið hlaðin upp á sölur þessa viðskiptavinar.',
  },

  // ---------------------------------------------------------------------------
  // Unified file-type labels — used by deal_files, po_files and company_files
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Hönnun — global file discovery screen
  // ---------------------------------------------------------------------------
  hönnunScreen: {
    pageTitle:           'Hönnun',
    searchPlaceholder:   'Leita að nafni, viðskiptavini, vörulínu...',
    filterAll:           'Allar',
    filterCompany:       'Viðskiptavinir',
    filterType:          'Tegund',
    filterDateRange:     'Dagsetning',
    filterFrom:          'Frá',
    filterTo:            'Til',
    allCompanies:        'Allir viðskiptavinir',
    noFiles:             'Engin skjöl fundust',
    emptyHint:           'Hönnunarskjöl birtast hér þegar þeim er hlaðið upp á sölur eða í vörumerki viðskiptavina.',
    resultsCount:        '{count} skjöl',
    source:              'Heimild',
    sourceCompanyBrand:  'Vörumerki',
    sourceDeal:          'Sala',
    clearFilters:        'Hreinsa síur',
    typeMockup:          'Mockup',
    typeArtwork:         'Hönnun',
    typeLogo:            'Logo',
    typePresentation:    'Kynning',
    typeBrand:           'Vörumerki',
  },

  // ---------------------------------------------------------------------------
  // Multi-file upload dialog
  // ---------------------------------------------------------------------------
  upload: {
    title:             'Hlaða upp skjölum',
    titleBrand:        'Hlaða upp brand-skjölum',
    dropzone:          'Dragðu skrár hingað eða smelltu',
    addMore:           'Bæta við fleiri skrám',
    setAllAs:          'Setja allt sem',
    clearAll:          'Hreinsa allt',
    fileCount:         '{count} skrár valdar',
    uploadButton:      'Hlaða upp',
    uploadingProgress: 'Hleður upp {current} af {total}...',
    uploadComplete:    '{count} skrár hlaðnar upp',
    partialFailure:    '{success} af {total} tókst, {failed} mistókust',
    retryFailed:       'Reyna aftur',
    removeFile:        'Fjarlægja',
  },

  fileType: {
    mockup:             'Mockup',
    artwork:            'Hönnun',
    logo:               'Logo',
    presentation:       'Kynning',
    quote:              'Tilboð',
    invoice:            'Reikningur',
    proof:              'Print proof',
    order_confirmation: 'Pöntunarstaðfesting',
    brand_guidelines:   'Vörumerkjastefna',
    font:               'Letur',
    color_scheme:       'Litaskema',
    master_artwork:     'Aðal hönnun',
    other:              'Annað',
  },

  // ---------------------------------------------------------------------------
  // Yfirlit (dashboard / landing page)
  // ---------------------------------------------------------------------------
  yfirlit: {
    pageTitle:        'Yfirlit',
    greetingMorning:  'Góðan daginn',
    greetingAfter:    'Góðan dag',
    greetingEvening:  'Gott kvöld',
    viewingFor:       'Skoða fyrir',
    viewingForLabel:  'Yfirlit fyrir',

    myTasksTitle:        'VERKEFNI SEM ÞARF AÐ SKOÐA',
    myTasksTitleOther:   'VERKEFNI SEM {name} ÞARF AÐ SKOÐA',
    myTasksEmpty:        'Engin sérstök verkefni í dag',
    taskOverdue:         'Á að afhenda',
    taskUninvoiced:      'Reikningur ekki gefinn út',
    taskDefectPending:   'Galli án viðbragða',
    taskUnpaidOld:       'Greiðsla á gjalddaga',
    taskDeliveryMismatch:'Áætluð móttaka eftir áætlaða afhendingu',
    taskPoInvoiceApproval:'Reikningur frá birgi þarfnast samþykkis',
    showMore:            '{count} fleiri',

    pulseTitle:          'Síðustu 30 dagar',
    pulseRevenue:        'Tekjur',
    pulseDeals:          'Sölur kláraðar',
    pulseAvgDeal:        'Meðalsala',
    pulseMargin:         'Framlegð',
    pulseVsPrevious:     '',

    pipelineTitle:       'Opnar sölur',
    pipelineTotal:       'Heildarverðmæti opinna sala',
    noOpenDeals:         'Engar opnar sölur',

    marginTrendTitle:    'SALA OG FRAMLEGÐAR % SÍÐUSTU 6 MÁNUÐI',

    topCustomersTitle:   'Stærstu viðskiptavinir (þetta ár)',
    noCustomersYet:      'Engir viðskiptavinir með skráðar tekjur',
    dealsCount:          '{n} sölur',

    recentActivityTitle: 'Nýlegt',
    noRecentActivity:    'Engin nýleg virkni',

    exportButton:        'Hlaða niður skýrslu',
    exportDialog: {
      title:             'Hlaða niður skýrslu',
      period:            'Tímabil',
      periodMonth:       'Mánuður',
      periodYTD:         'Þetta ár',
      periodLastYear:    'Síðasta ár',
      selectMonth:       'Veldu mánuð',
      language:          'Tungumál',
      languageIs:        'Íslenska',
      languageEn:        'English',
      download:          'Hlaða niður',
      cancel:            'Hætta við',
    },

    monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'Maí', 'Jún', 'Júl', 'Ágú', 'Sep', 'Okt', 'Nóv', 'Des'],
    monthsLong:  ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'],
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
