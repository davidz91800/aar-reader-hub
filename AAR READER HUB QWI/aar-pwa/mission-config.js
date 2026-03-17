// Configuration des choix mission (modifiable par admin).
// - tacOperations: ajoutez ici les operations proposees aux utilisateurs.
// - tacExercises: ajoutez/supprimez des types d'exercice TAC.
// - hashtags: catalogue initial de hashtags proposes dans le formulaire.
// - logAirfieldsByCountry: liste des terrains OACI par pays (format "ICAO Nom").
window.AARMissionConfig = {
  "allCountries": [
    "Afghanistan",
    "Afrique du Sud",
    "Ahvenanmaa",
    "Albanie",
    "Alg\u00e9rie",
    "Allemagne",
    "Andorre",
    "Angola",
    "Anguilla",
    "Antarctique",
    "Antigua-et-Barbuda",
    "Arabie Saoudite",
    "Argentine",
    "Arm\u00e9nie",
    "Aruba",
    "Australie",
    "Autriche",
    "Azerba\u00efdjan",
    "Bahamas",
    "Bahre\u00efn",
    "Bangladesh",
    "Barbade",
    "Belgique",
    "Belize",
    "Bermudes",
    "Bhoutan",
    "Birmanie",
    "Bi\u00e9lorussie",
    "Bolivie",
    "Bosnie-Herz\u00e9govine",
    "Botswana",
    "Brunei",
    "Br\u00e9sil",
    "Bulgarie",
    "Burkina Faso",
    "Burundi",
    "B\u00e9nin",
    "Cambodge",
    "Cameroun",
    "Canada",
    "Chili",
    "Chine",
    "Chypre",
    "Cit\u00e9 du Vatican",
    "Colombie",
    "Comores",
    "Congo",
    "Congo (R\u00e9p. d\u00e9m.)",
    "Cor\u00e9e du Nord",
    "Cor\u00e9e du Sud",
    "Costa Rica",
    "Croatie",
    "Cuba",
    "Cura\u00e7ao",
    "C\u00f4te d'Ivoire",
    "Danemark",
    "Djibouti",
    "Dominique",
    "Espagne",
    "Estonie",
    "Fidji",
    "Finlande",
    "France",
    "Gabon",
    "Gambie",
    "Ghana",
    "Gibraltar",
    "Grenade",
    "Groenland",
    "Gr\u00e8ce",
    "Guadeloupe",
    "Guam",
    "Guatemala",
    "Guernesey",
    "Guin\u00e9e",
    "Guin\u00e9e \u00e9quatoriale",
    "Guin\u00e9e-Bissau",
    "Guyana",
    "Guyane",
    "G\u00e9orgie",
    "G\u00e9orgie du Sud-et-les \u00celes Sandwich du Sud",
    "Ha\u00efti",
    "Honduras",
    "Hong Kong",
    "Hongrie",
    "Inde",
    "Indon\u00e9sie",
    "Irak",
    "Iran",
    "Irlande",
    "Islande",
    "Isra\u00ebl",
    "Italie",
    "Jama\u00efque",
    "Japon",
    "Jersey",
    "Jordanie",
    "Kazakhstan",
    "Kenya",
    "Kirghizistan",
    "Kiribati",
    "Kosovo",
    "Kowe\u00eft",
    "Laos",
    "Lesotho",
    "Lettonie",
    "Liban",
    "Liberia",
    "Libye",
    "Liechtenstein",
    "Lituanie",
    "Luxembourg",
    "Macao",
    "Mac\u00e9doine du Nord",
    "Madagascar",
    "Malaisie",
    "Malawi",
    "Maldives",
    "Mali",
    "Malte",
    "Maroc",
    "Martinique",
    "Mauritanie",
    "Mayotte",
    "Mexique",
    "Micron\u00e9sie",
    "Moldavie",
    "Monaco",
    "Mongolie",
    "Montserrat",
    "Mont\u00e9n\u00e9gro",
    "Mozambique",
    "Namibie",
    "Nauru",
    "Nicaragua",
    "Niger",
    "Nig\u00e9ria",
    "Niue",
    "Norv\u00e8ge",
    "Nouvelle-Cal\u00e9donie",
    "Nouvelle-Z\u00e9lande",
    "N\u00e9pal",
    "Oman",
    "Ouganda",
    "Ouzb\u00e9kistan",
    "Pakistan",
    "Palaos (Palau)",
    "Palestine",
    "Panama",
    "Papouasie-Nouvelle-Guin\u00e9e",
    "Paraguay",
    "Pays-Bas",
    "Pays-Bas carib\u00e9ens",
    "Philippines",
    "Pologne",
    "Polyn\u00e9sie fran\u00e7aise",
    "Porto Rico",
    "Portugal",
    "P\u00e9rou",
    "Qatar",
    "Roumanie",
    "Royaume-Uni",
    "Russie",
    "Rwanda",
    "R\u00e9publique centrafricaine",
    "R\u00e9publique dominicaine",
    "R\u00e9union",
    "Sahara Occidental",
    "Saint-Barth\u00e9lemy",
    "Saint-Christophe-et-Ni\u00e9v\u00e8s",
    "Saint-Marin",
    "Saint-Martin",
    "Saint-Pierre-et-Miquelon",
    "Saint-Vincent-et-les-Grenadines",
    "Sainte-H\u00e9l\u00e8ne, Ascension et Tristan da Cunha",
    "Sainte-Lucie",
    "Salvador",
    "Samoa",
    "Samoa am\u00e9ricaines",
    "Serbie",
    "Seychelles",
    "Sierra Leone",
    "Singapour",
    "Slovaquie",
    "Slov\u00e9nie",
    "Somalie",
    "Soudan",
    "Soudan du Sud",
    "Sri Lanka",
    "Suisse",
    "Surinam",
    "Su\u00e8de",
    "Svalbard et Jan Mayen",
    "Swaziland",
    "Syrie",
    "S\u00e3o Tom\u00e9 et Pr\u00edncipe",
    "S\u00e9n\u00e9gal",
    "Tadjikistan",
    "Tanzanie",
    "Ta\u00efwan",
    "Tchad",
    "Tch\u00e9quie",
    "Terres australes et antarctiques fran\u00e7aises",
    "Territoire britannique de l'oc\u00e9an Indien",
    "Tha\u00eflande",
    "Timor oriental",
    "Togo",
    "Tokelau",
    "Tonga",
    "Trinit\u00e9-et-Tobago",
    "Tunisie",
    "Turkm\u00e9nistan",
    "Turquie",
    "Tuvalu",
    "Ukraine",
    "Uruguay",
    "Vanuatu",
    "Venezuela",
    "Vi\u00eat Nam",
    "Wallis-et-Futuna",
    "Y\u00e9men",
    "Zambie",
    "Zimbabwe",
    "\u00c9gypte",
    "\u00c9mirats arabes unis",
    "\u00c9quateur",
    "\u00c9rythr\u00e9e",
    "\u00c9tats-Unis",
    "\u00c9thiopie",
    "\u00cele Bouvet",
    "\u00cele Christmas",
    "\u00cele de Man",
    "\u00cele Maurice",
    "\u00cele Norfolk",
    "\u00celes Ca\u00efmans",
    "\u00celes Cocos",
    "\u00celes Cook",
    "\u00celes du Cap-Vert",
    "\u00celes F\u00e9ro\u00e9",
    "\u00celes Heard-et-MacDonald",
    "\u00celes Malouines",
    "\u00celes Mariannes du Nord",
    "\u00celes Marshall",
    "\u00celes mineures \u00e9loign\u00e9es des \u00c9tats-Unis",
    "\u00celes Pitcairn",
    "\u00celes Salomon",
    "\u00celes Turques-et-Ca\u00efques",
    "\u00celes Vierges britanniques",
    "\u00celes Vierges des \u00c9tats-Unis"
  ],
  "tacOperations": [
    "Proche et Moyen Orient (PMO)"
  ],
  "tacExercises": [
    "TRAINING",
    "ATLC",
    "TLP",
    "ETAP-C Single Ship",
    "ETAP-C Multiple Ship"
  ],
  "hashtags": [
    "#RETEX"
  ],
  "logAirfieldsByCountry": {
    "Afghanistan": [
      "OAKN Ahmad Shah Baba International Airport",
      "OAHR Herat - Khwaja Abdullah Ansari International Airport",
      "OAKB Kabul International Airport",
      "OAMS Mazar-i-Sharif International Airport",
      "OAKS Khost International Airport"
    ],
    "Afrique du Sud": [
      "FABL Bram Fischer International Airport",
      "FACT Cape Town International Airport",
      "FAPE Chief Dawid Stuurman International Airport",
      "FAGG George Airport",
      "FAKM Kimberley Airport"
    ],
    "Albanie": [
      "LATI Tirana International Airport Mother Teresa",
      "LAKU Kuk\u00ebs International Airport",
      "LAKV Ku\u00e7ov\u00eb Air Base"
    ],
    "Alg\u00e9rie": [
      "DAAT Aguenar \u2013 Hadj Bey Akhamok Airport",
      "DABB Annaba Rabah Bitat Airport",
      "DABT Batna Mostefa Ben Boulaid Airport",
      "DAUB Biskra - Mohamed Khider Airport",
      "DAOI Chlef Aboubakr Belkaid International Airport"
    ],
    "Allemagne": [
      "EDDB Berlin Brandenburg Airport",
      "EDNY Bodensee Airport Friedrichshafen",
      "EDDW Bremen Airport",
      "EDDK Cologne Bonn Airport",
      "EDLW Dortmund Airport"
    ],
    "Angola": [
      "FNBJ Dr. Antonio Agostinho Neto International Airport",
      "FNLU Quatro de Fevereiro International Airport",
      "FNHU Albano Machado Airport",
      "FNCA Cabinda Airport",
      "FNCT Catumbela Airport"
    ],
    "Anguilla": [
      "TQPF Clayton J. Lloyd International Airport"
    ],
    "Antarctique": [
      "SCRM Teniente Rodolfo Marsh Martin Airport",
      "NZSP Amundsen\u2013Scott South Pole Station Airport",
      "EGAH Halley Research Station",
      "SCPZ Patriot Hills Airport",
      "EGAR Rothera Research Station"
    ],
    "Antigua-et-Barbuda": [
      "TAPA V. C. Bird International Airport",
      "TAPB Burton-Nibbs International Airport",
      "TAPT Coco Point Lodge Airstrip"
    ],
    "Arabie Saoudite": [
      "OEAB Abha International Airport",
      "OEAH Al-Ahsa International Airport",
      "OESK Al-Jawf International Airport",
      "OEJN King Abdulaziz International Airport",
      "OEDF King Fahd International Airport"
    ],
    "Argentine": [
      "SABE Aeroparque Jorge Newbery",
      "SAEZ Ezeiza International Airport - Ministro Pistarini",
      "SAVC General Enrique Mosconi International Airport",
      "SASJ Gobernador Horacio Guzman International Airport",
      "SAME Governor Francisco Gabrielli International Airport"
    ],
    "Arm\u00e9nie": [
      "UDSG Shirak International Airport",
      "UDYZ Zvartnots International Airport",
      "UDCK Syunik Airport"
    ],
    "Aruba": [
      "TNCA Queen Beatrix International Airport"
    ],
    "Australie": [
      "YPAD Adelaide International Airport",
      "YBBN Brisbane International Airport",
      "YBRM Broome International Airport",
      "YBCS Cairns International Airport",
      "YPDN Darwin International Airport / RAAF Darwin"
    ],
    "Autriche": [
      "LOWG Graz Airport",
      "LOWI Innsbruck Airport",
      "LOWK Klagenfurt Airport",
      "LOWL Linz-H\u00f6rsching Airport",
      "LOWS Salzburg Airport"
    ],
    "Azerba\u00efdjan": [
      "UBBG Ganja International Airport",
      "UBBB Heydar Aliyev International Airport",
      "UBBN Nakhchivan International Airport",
      "UBBQ Gabala International Airport",
      "UBBL Lankaran International Airport"
    ],
    "Bahamas": [
      "MYGF Grand Bahama International Airport",
      "MYNN Lynden Pindling International Airport",
      "MYSM San Salvador International Airport",
      "MYAF Andros Town Airport",
      "MYCA Arthur's Town Airport"
    ],
    "Bahre\u00efn": [
      "OBBI Bahrain International Airport",
      "OBBS Sheik Isa Air Base",
      "OBKH Sakhir Air Base"
    ],
    "Bangladesh": [
      "VGHS Hazrat Shahjalal International Airport",
      "VGSY Osmany International Airport",
      "VGEG Shah Amanat International Airport",
      "VGBR Barisal Airport",
      "VGCB Cox's Bazar Airport"
    ],
    "Barbade": [
      "TBPB Grantley Adams International Airport"
    ],
    "Belgique": [
      "EBBR Brussels Airport",
      "EBCI Brussels South Charleroi Airport",
      "EBOS Ostend-Bruges International Airport",
      "EBAW Antwerp International Airport (Deurne)",
      "EBLG Li\u00e8ge Airport"
    ],
    "Belize": [
      "MZBZ Philip S. W. Goldson International Airport",
      "MZPL Placencia Airport"
    ],
    "Bermudes": [
      "TXKF L.F. Wade International Airport"
    ],
    "Bhoutan": [
      "VQPR Paro International Airport",
      "VQBT Bathpalathang Airport",
      "VQTY Yongphulla Airport",
      "VQGP Gelephu Airport"
    ],
    "Birmanie": [
      "VYMD Mandalay International Airport",
      "VYNT Nay Pyi Taw International Airport",
      "VYYY Yangon International Airport",
      "VYDW Dawei Airport",
      "VYHH Heho Airport"
    ],
    "Bi\u00e9lorussie": [
      "UMBB Brest International Airport",
      "UMMS Minsk National Airport",
      "UMGG Gomel Airport",
      "UMOO Mogilev Airport",
      "UMMG Hrodna Airport"
    ],
    "Bolivie": [
      "SLAL Alcantar\u00ed International Airport",
      "SLLP El Alto International Airport",
      "SLCB Jorge Wilsterman International Airport",
      "SLOR Juan Mendoza International Airport",
      "SLVR Viru Viru International Airport"
    ],
    "Bosnie-Herz\u00e9govine": [
      "LQBK Banja Luka International Airport",
      "LQMO Mostar International Airport",
      "LQSA Sarajevo International Airport",
      "LQTZ Tuzla International Airport",
      "LQBZ Banja Luka Zalu\u017eani Airfield"
    ],
    "Botswana": [
      "FBKE Kasane International Airport",
      "FBMN Maun International Airport",
      "FBPM Phillip Gaonwe Matante International Airport",
      "FBSK Sir Seretse Khama International Airport",
      "FBSW Shakawe Airport"
    ],
    "Brunei": [
      "WBSB Brunei International Airport",
      "WBAK Anduki Airport"
    ],
    "Br\u00e9sil": [
      "SBBV Atlas Brasil Cantanhede International Airport",
      "SBFI Cataratas International Airport",
      "SBSP Congonhas\u2013Deputado Freitas Nobre Airport",
      "SBCT Curitiba-Afonso Pena International Airport",
      "SBSV Deputado Luiz Eduardo Magalh\u00e3es International Airport"
    ],
    "Bulgarie": [
      "LBBG Burgas Airport",
      "LBPD Plovdiv International Airport",
      "LBSF Sofia Airport",
      "LBWN Varna Airport",
      "LBWB Balchik Airfield"
    ],
    "Burkina Faso": [
      "DFOO Bobo Dioulasso Airport",
      "DFFD Ouagadougou Thomas Sankara International Airport",
      "DFOY Aribinda Airport",
      "DFER Arly Airport",
      "DFOB Banfora Airport"
    ],
    "Burundi": [
      "HBBA Bujumbura Melchior Ndadaye International Airport",
      "HBBE Gitega Airport",
      "HBBO Kirundo Airport",
      "HBBK Gihohi Airport"
    ],
    "B\u00e9nin": [
      "DBBB Cotonou Cadjehoun International Airport",
      "DBBR Bembereke Airport",
      "DBBC Bohicon/Cana Airport",
      "DBBD Djougou Airport",
      "DBBK Kandi Airport"
    ],
    "Cambodge": [
      "VDSA Siem Reap-Angkor International Airport",
      "VDSV Sihanouk International Airport",
      "VDTI Techo International Airport",
      "VDBG Battambang Airport",
      "VDPP Phnom Penh International Airport"
    ],
    "Cameroun": [
      "FKKD Douala International Airport",
      "FKKR Garoua International Airport",
      "FKYS Yaound\u00e9 Nsimalen International Airport",
      "FKKN N'Gaound\u00e9r\u00e9 Airport",
      "FKKL Salak Airport"
    ],
    "Canada": [
      "CYYC Calgary International Airport",
      "CYEG Edmonton International Airport",
      "CYHZ Halifax / Stanfield International Airport",
      "CYLW Kelowna International Airport",
      "CYUL Montreal / Pierre Elliott Trudeau International Airport"
    ],
    "Chili": [
      "SCFA Andr\u00e9s Sabella G\u00e1lvez International Airport",
      "SCIE Carriel Sur International Airport",
      "SCEL Comodoro Arturo Merino Ben\u00edtez International Airport",
      "SCDA Diego Aracena International Airport",
      "SCTE El Tepual International Airport"
    ],
    "Chine": [
      "ZBOW Baotou Donghe International Airport",
      "ZBAA Beijing Capital International Airport",
      "ZBAD Beijing Daxing International Airport",
      "ZYCC Changchun Longjia International Airport",
      "ZGHA Changsha Huanghua International Airport"
    ],
    "Chypre": [
      "LCEN Ercan International Airport",
      "LCLK Larnaca International Airport",
      "LCPH Paphos International Airport",
      "LCGK Lefkoniko Airport / Ge\u00e7itkale Air Base",
      "LCRA RAF Akrotiri"
    ],
    "Colombie": [
      "SKCL Alfonso Bonilla Aragon International Airport",
      "SKBO El Dorado International Airport",
      "SKBQ Ernesto Cortissoz International Airport",
      "SKSP Gustavo Rojas Pinilla International Airport",
      "SKRG Jose Maria C\u00f3rdova International Airport"
    ],
    "Comores": [
      "FMCH Prince Said Ibrahim International Airport",
      "FMCV Ouani Airport",
      "FMCI Moh\u00e9li Bandar Es Eslam Airport"
    ],
    "Congo": [
      "FCPP Antonio Agostinho-Neto International Airport",
      "FCBB Maya-Maya International Airport",
      "FCPD Ngot Nzoungou Airport",
      "FCOU Ouesso Airport",
      "FCOO Owando Airport"
    ],
    "Congo (R\u00e9p. d\u00e9m.)": [
      "FZIC Bangoka International Airport",
      "FZNA Goma International Airport",
      "FZQA Lubumbashi International Airport",
      "FZAA Ndjili International Airport",
      "FZBO Bandundu Airport"
    ],
    "Cor\u00e9e du Nord": [
      "ZKPY Pyongyang Sunan International Airport",
      "ZKHM Orang (Chongjin) Airport",
      "ZKSD Sondok Airport",
      "ZKWS Wonsan Kalma International Airport",
      "ZKSE Samjiy\u014fn Airport"
    ],
    "Cor\u00e9e du Sud": [
      "RKTU Cheongju International Airport/Cheongju Air Base (K-59/G-513)",
      "RKTN Daegu International Airport",
      "RKPK Gimhae International Airport",
      "RKSS Gimpo International Airport",
      "RKSI Incheon International Airport"
    ],
    "Costa Rica": [
      "MRLB Daniel Oduber Quir\u00f3s International Airport",
      "MROC Juan Santamar\u00eda International Airport",
      "MRGF Golfito Airport",
      "MRAN La Fortuna Arenal Airport",
      "MRLM Lim\u00f3n International Airport"
    ],
    "Croatie": [
      "LDDU Dubrovnik Ru\u0111er Bo\u0161kovi\u0107 Airport",
      "LDPL Pula Airport",
      "LDRI Rijeka Airport",
      "LDSP Split Saint Jerome Airport",
      "LDZD Zadar Airport"
    ],
    "Cuba": [
      "MUSC Abel Santamaria International Airport",
      "MUCU Antonio Maceo International Airport",
      "MUHG Frank Pais International Airport",
      "MUCM Ignacio Agramonte International Airport",
      "MUHA Jos\u00e9 Mart\u00ed International Airport"
    ],
    "Cura\u00e7ao": [
      "TNCC Hato International Airport"
    ],
    "C\u00f4te d'Ivoire": [
      "DIAP F\u00e9lix-Houphou\u00ebt-Boigny International Airport",
      "DIBK Bouak\u00e9 Airport",
      "DIKO Korhogo Airport",
      "DISP San Pedro Airport",
      "DIYO Yamoussoukro International Airport"
    ],
    "Danemark": [
      "EKYT Aalborg Airport",
      "EKAH Aarhus Airport",
      "EKBI Billund Airport",
      "EKCH Copenhagen Kastrup Airport",
      "EKOD Odense Hans Christian Andersen Airport"
    ],
    "Djibouti": [
      "HDAM Djibouti-Ambouli Airport",
      "HDAS Ali-Sabieh Airport",
      "HDCH Chabelley Airport",
      "HDDK Dikhil Airport",
      "HDHE Herkale Airport"
    ],
    "Dominique": [
      "TDCF Canefield Airport",
      "TDPD Douglas-Charles Airport"
    ],
    "Espagne": [
      "LEMD Adolfo Su\u00e1rez Madrid\u2013Barajas Airport",
      "LEAL Alicante-Elche Miguel Hern\u00e1ndez Airport",
      "LEAS Asturias Airport",
      "LEBB Bilbao Airport",
      "GCRR C\u00e9sar Manrique-Lanzarote Airport"
    ],
    "Estonie": [
      "EETN Lennart Meri Tallinn Airport",
      "EEKE Kuressaare Airport",
      "EEKA K\u00e4rdla Airport",
      "EEPU P\u00e4rnu Airport",
      "EETU Tartu Airport"
    ],
    "Fidji": [
      "NFFN Nadi International Airport",
      "NFNA Nausori International Airport",
      "NFNL Labasa Airport",
      "NFCI Cicia Airport",
      "NFNO Koro Island Airport"
    ],
    "Finlande": [
      "EFHK Helsinki Vantaa Airport",
      "EFIV Ivalo Airport",
      "EFKT Kittil\u00e4 International Airport",
      "EFKU Kuopio Airport",
      "EFLP Lappeenranta Airport"
    ],
    "France": [
      "LFOE Evreux",
      "LFOJ Orleans-Bricy",
      "LFBM Mont-de-Marsan",
      "LFBO Toulouse-Blagnac",
      "LFOA Avord",
      "LFMI Istres",
      "LFSI Saint-Dizier",
      "LFMO Orange-Caritat",
      "LFMY Salon-de-Provence",
      "LFKS Solenzara",
      "LFBF Toulouse-Francazal"
    ],
    "Gabon": [
      "FOOL Libreville Leon M'ba International Airport",
      "FOON M'Vengue El Hadj Omar Bongo Ondimba International Airport",
      "FOOG Port Gentil International Airport",
      "FOOK Makokou Airport",
      "FOGO Oyem Airport"
    ],
    "Gambie": [
      "GBYD Banjul International Airport"
    ],
    "Ghana": [
      "DGAA Kotoka International Airport",
      "DGSI Prempeh I International Airport",
      "DGLE Yakubu Tali International Airport",
      "DGAH Ho Airport",
      "DGSN Sunyani Airport"
    ],
    "Gibraltar": [
      "LXGB Gibraltar Airport"
    ],
    "Grenade": [
      "TGPY Maurice Bishop International Airport",
      "TGPZ Lauriston Airport"
    ],
    "Groenland": [
      "BGSF Kangerlussuaq International Airport",
      "BGGH Nuuk International Airport",
      "BGTL Pituffik Space Base",
      "BGAA Aasiaat Airport",
      "BGJN Ilulissat Airport"
    ],
    "Gr\u00e8ce": [
      "LGAV Athens Eleftherios Venizelos International Airport",
      "LGSA Chania International Airport",
      "LGKR Corfu Ioannis Kapodistrias International Airport",
      "LGIR Heraklion International Nikos Kazantzakis Airport",
      "LGKV Kavala Alexander the Great International Airport"
    ],
    "Guadeloupe": [
      "TFFR Maryse Cond\u00e9 International Airport",
      "TFFM Marie-Galante Airport",
      "TFFB Basse-Terre Baillif Airport",
      "TFFA La D\u00e9sirade Airport",
      "TFFC St-Fran\u00e7ois Airport"
    ],
    "Guam": [
      "PGUM Antonio B. Won Pat International Airport",
      "PGUA Andersen Air Force Base"
    ],
    "Guatemala": [
      "MGGT La Aurora International Airport",
      "MGPB Puerto Barrios Airport",
      "MGRT Retalhuleu Airport",
      "MGHT Huehuetenango Airport",
      "MGQZ Quezaltenango Airport"
    ],
    "Guernesey": [
      "EGJA Alderney Airport",
      "EGJB Guernsey Airport"
    ],
    "Guin\u00e9e": [
      "GUCY Ahmed S\u00e9kou Tour\u00e9 International Airport",
      "GUBE Beyla Airport",
      "GUOK Bok\u00e9 Baralande Airport",
      "GUFH Faranah Airport",
      "GUFA Fria Airport"
    ],
    "Guin\u00e9e \u00e9quatoriale": [
      "FGBT Bata International Airport",
      "FGSL Malabo International Airport",
      "FGMY President Obiang Nguema International Airport"
    ],
    "Guin\u00e9e-Bissau": [
      "GGOV Osvaldo Vieira International Airport",
      "GGBU Bubaque Airport",
      "GGCF Cufar Airport"
    ],
    "Guyana": [
      "SYCJ Cheddi Jagan International Airport",
      "SYEC Eugene F. Correia International Airport",
      "SYKA Kaieteur Airport",
      "SYLT Lethem Airport",
      "SYAH Aishalton Airport"
    ],
    "Guyane": [
      "SOCA Cayenne \u2013 F\u00e9lix Ebou\u00e9 Airport",
      "SOOA Maripasoula Airport",
      "SOOM Saint-Laurent-du-Maroni Airport",
      "SOOG Saint-Georges-de-l'Oyapock Airport",
      "SOGS Grand-Santi Airport"
    ],
    "G\u00e9orgie": [
      "UGSB Alexander Kartveli Batumi International Airport",
      "UGKO David the Builder Kutaisi International Airport",
      "UGTB Tbilisi International Airport",
      "UGAM Ambrolauri Airport",
      "UGSS Vladislav Ardzinba Sukhum International Airport"
    ],
    "Ha\u00efti": [
      "MTCH Cap Haitien International Airport",
      "MTPP Toussaint Louverture International Airport",
      "MTCA Antoine-Simon International Airport",
      "MTJE J\u00e9r\u00e9mie Airport",
      "MTJA Jacmel Airport"
    ],
    "Honduras": [
      "MHRO Juan Manuel G\u00e1lvez International Airport",
      "MHPR Palmerola International Airport",
      "MHLM Ram\u00f3n Villeda Morales International Airport",
      "MHLC Golos\u00f3n International Airport",
      "MHNJ La Laguna Airport"
    ],
    "Hong Kong": [
      "VHHH Hong Kong International Airport",
      "VHSK Shek Kong Air Base"
    ],
    "Hongrie": [
      "LHBP Budapest Liszt Ferenc International Airport",
      "LHDC Debrecen International Airport",
      "LHPP P\u00e9cs-Pog\u00e1ny International Airport",
      "LHPR Gy\u0151r-P\u00e9r Airport",
      "LHSM H\u00e9v\u00edz\u2013Balaton Airport"
    ],
    "Inde": [
      "VEBD Bagdogra Airport",
      "VEBS Biju Patnaik International Airport",
      "VEIM Bir Tikendrajit International Airport",
      "VOCL Calicut International Airport",
      "VILK Chaudhary Charan Singh International Airport"
    ],
    "Indon\u00e9sie": [
      "WAHH Adisutjipto International Airport",
      "WADD Denpasar I Gusti Ngurah Rai International Airport",
      "WAJJ Dortheys Hiyo Eluay International Airport",
      "WIHH Halim Perdanakusuma International Airport",
      "WIDD Hang Nadim International Airport"
    ],
    "Irak": [
      "ORNI Al Najaf International Airport",
      "ORBI Baghdad International Airport / New Al Muthana Air Base",
      "ORMM Basra International Airport",
      "ORER Erbil International Airport",
      "ORKK Kirkuk International Airport"
    ],
    "Iran": [
      "OIAA Abadan Ayatollah Jami International Airport",
      "OIKK Ayatollah Hashemi Rafsanjani International Airport",
      "OIKB Bandar Abbas International Airport",
      "OIMB Birjand International Airport",
      "OIIE Imam Khomeini International Airport"
    ],
    "Irlande": [
      "EICK Cork International Airport",
      "EIDW Dublin Airport",
      "EIKN Ireland West Airport Knock",
      "EINN Shannon Airport",
      "EIDL Donegal Airport"
    ],
    "Islande": [
      "BIAR Akureyri International Airport",
      "BIKF Keflavik International Airport",
      "BIEG Egilssta\u00f0ir Airport",
      "BIGR Gr\u00edmsey Airport",
      "BIHN Hornafj\u00f6r\u00f0ur Airport"
    ],
    "Isra\u00ebl": [
      "LLBG Ben Gurion International Airport",
      "LLER Ramon International Airport",
      "LLHA Uri Michaeli Haifa International Airport",
      "LLMZ Bar Yehuda Airfield",
      "LLNV Nevatim Air Base"
    ],
    "Italie": [
      "LIBP Abruzzo Airport",
      "LIBD Bari Karol Wojty\u0142a International Airport",
      "LIPE Bologna Guglielmo Marconi Airport",
      "LIBR Brindisi Airport",
      "LIEE Cagliari Elmas Airport"
    ],
    "Jama\u00efque": [
      "MKJP Norman Manley International Airport",
      "MKJS Sangster International Airport",
      "MKBS Ian Fleming International Airport",
      "MKTP Tinson Pen Airport",
      "MKKJ Ken Jones Airport"
    ],
    "Japon": [
      "RJSA Aomori Airport",
      "RJGG Chubu Centrair International Airport",
      "RJFF Fukuoka Airport",
      "RJCH Hakodate Airport",
      "RJOA Hiroshima Airport"
    ],
    "Jersey": [
      "EGJJ Jersey Airport"
    ],
    "Jordanie": [
      "OJAQ King Hussein International Airport",
      "OJAM Marka International (Amman Civil) Airport",
      "OJAI Queen Alia International Airport",
      "OJKF King Feisal Air Base",
      "OJMS Muwaffaq Salti Air Base"
    ],
    "Kazakhstan": [
      "UATE Aktau International Airport",
      "UATT Aktobe International Airport",
      "UAAA Almaty International Airport",
      "UATG Atyrau International Airport",
      "UAOL Baikonur Krayniy International Airport"
    ],
    "Kenya": [
      "HKEL Eldoret International Airport",
      "HKJK Jomo Kenyatta International Airport",
      "HKKI Kisumu International Airport",
      "HKMO Moi International Airport",
      "HKAM Amboseli Airport"
    ],
    "Kirghizistan": [
      "UCFL Issyk-Kul International Airport",
      "UCFM Manas International Airport",
      "UCFO Osh International Airport",
      "UCFB Batken Airport",
      "UCFD Jalal-Abad Airport"
    ],
    "Kiribati": [
      "NGTA Bonriki International Airport",
      "PLCH Cassidy International Airport",
      "NGUK Aranuka Airport",
      "NGTU Butaritari Airport",
      "PCIS Canton Island Airport"
    ],
    "Kosovo": [
      "BKPR Pri\u0161tina Adem Jashari International Airport"
    ],
    "Kowe\u00eft": [
      "OKKK Kuwait International Airport",
      "OKAJ Ahmed Al Jaber Air Base",
      "OKAS Ali Al Salem Air Base"
    ],
    "Laos": [
      "VLLB Luang Phabang International Airport",
      "VLPS Pakse International Airport",
      "VLVT Wattay International Airport",
      "VLLN Luang Namtha Airport",
      "VLOS Oudomsay Airport"
    ],
    "Lesotho": [
      "FXMM Moshoeshoe I International Airport",
      "FXLK Lebakeng Airport",
      "FXLR Leribe Airport",
      "FXLS Lesobeng Airport",
      "FXMF Mafeteng Airport"
    ],
    "Lettonie": [
      "EVRA Riga International Airport",
      "EVLA Liep\u0101ja International Airport",
      "EVDA Daugavpils International Airport",
      "EVCA C\u0113sis Airfield",
      "EVPA Ikshkile Airfield"
    ],
    "Liban": [
      "OLBA Beirut Rafic Hariri International Airport",
      "OLKA Rene Mouawad Air Base"
    ],
    "Liberia": [
      "GLRB Roberts International Airport",
      "GLMR Spriggs Payne Airport",
      "GLGE Greenville/Sinoe Airport",
      "GLBU Buchanan Airport",
      "GLCP Cape Palmas Airport"
    ],
    "Libye": [
      "HLLQ Al Abraq International Airport",
      "HLLB Benina International Airport",
      "HLLM Mitiga International Airport",
      "HLTD Ghadames Airport",
      "HLGT Ghat Airport"
    ],
    "Lituanie": [
      "EYKA Kaunas International Airport",
      "EYPA Palanga International Airport",
      "EYVI Vilnius International Airport",
      "EYPP Panev\u0117\u017eys Air Base",
      "EYSA \u0160iauliai International Airport"
    ],
    "Luxembourg": [
      "ELLX Luxembourg-Findel International Airport"
    ],
    "Macao": [
      "VMMC Macau International Airport"
    ],
    "Mac\u00e9doine du Nord": [
      "LWOH Ohrid St. Paul the Apostle Airport",
      "LWSK Skopje International Airport",
      "LWST Suchevo Recreational Airfield"
    ],
    "Madagascar": [
      "FMNM Amborovy Airport",
      "FMMI Ivato International Airport",
      "FMMT Toamasina Ambalamanasy Airport",
      "FMNA Arrachart Airport",
      "FMNQ Besalampy Airport"
    ],
    "Malaisie": [
      "WBKK Kota Kinabalu International Airport",
      "WMKK Kuala Lumpur International Airport",
      "WBGG Kuching International Airport",
      "WMKP Penang International Airport",
      "WMKJ Senai International Airport"
    ],
    "Malawi": [
      "FWCL Chileka International Airport",
      "FWKI Kamuzu International Airport",
      "FWDW Dwangwa Airport",
      "FWKA Karonga Airport",
      "FWUU Mzuzu Airport"
    ],
    "Maldives": [
      "VRMG Gan International Airport",
      "VRMH Hanimaadhoo International Airport",
      "VRMM Velana International Airport",
      "VRMT Kaadedhdhoo Airport",
      "VRMK Kadhdhoo Airport"
    ],
    "Mali": [
      "GABS Modibo Keita International Airport",
      "GATB Tombouktou Airport",
      "GAGO Gao International Airport",
      "GAKD Kayes Dag Dag Airport",
      "GAMB Mopti Airport"
    ],
    "Malte": [
      "LMML Malta International Airport"
    ],
    "Maroc": [
      "GMAD Al Massira Airport",
      "GMMD Beni Mellal Airport",
      "GMFF Fes Sa\u00efss International Airport",
      "GMMX Marrakesh Menara Airport",
      "GMMN Mohammed V International Airport"
    ],
    "Martinique": [
      "TFFF Martinique Aim\u00e9 C\u00e9saire International Airport"
    ],
    "Mauritanie": [
      "GQPA Atar International Airport",
      "GQPP Nouadhibou International Airport",
      "GQNO Nouakchott\u2013Oumtounsy International Airport",
      "GQPZ Tazadit Airport",
      "GQNE Abbaye Airport"
    ],
    "Mayotte": [
      "FMCZ Dzaoudzi Pamandzi International Airport"
    ],
    "Mexique": [
      "MMCS Abraham Gonz\u00e1lez International Airport",
      "MMTO Adolfo L\u00f3pez Mateos International Airport",
      "MMAS Aguascalientes International Airport",
      "MMCL Bachigualato Federal International Airport",
      "MMBT Bah\u00edas de Huatulco International Airport"
    ],
    "Micron\u00e9sie": [
      "PTKK Chuuk International Airport",
      "PTSA Kosrae International Airport",
      "PTYA Yap International Airport",
      "PTPN Pohnpei International Airport"
    ],
    "Moldavie": [
      "LUKK Chi\u015fin\u0103u International Airport",
      "LUBL B\u0103l\u021bi-Leadoveni International Airport",
      "LUCH Cahul International Airport",
      "LUBM M\u0103rcule\u0219ti Air Base",
      "LUTR Tiraspol Airfield"
    ],
    "Mongolie": [
      "ZMCK Ulaanbaatar Chinggis Khaan International Airport",
      "ZMAT Altai Airport",
      "ZMAH Arvaikheer Airport",
      "ZMBH Bayankhongor Airport",
      "ZMBN Bulgan Airport"
    ],
    "Montserrat": [
      "TRPG John A. Osborne Airport"
    ],
    "Mont\u00e9n\u00e9gro": [
      "LYPG Podgorica Airport / Podgorica Golubovci Airbase",
      "LYTV Tivat Airport",
      "LYBR Berane Airport",
      "LYNK Nik\u0161i\u0107 Airfield",
      "LYPO \u0106emovsko Polje / \u0160piro Mugo\u0161a Airfield"
    ],
    "Mozambique": [
      "FQBR Beira International Airport",
      "FQMA Maputo Airport",
      "FQNP Nampula Airport",
      "FQTT Tete Airport",
      "FQCH Chimoio Airport"
    ],
    "Namibie": [
      "FYWH Hosea Kutako International Airport",
      "FYWB Walvis Bay International Airport",
      "FYWE Eros Airport",
      "FYKM Katima Mulilo Airport",
      "FYLZ Luderitz Airport"
    ],
    "Nauru": [
      "ANYN Nauru International Airport"
    ],
    "Nicaragua": [
      "MNMG Augusto C. Sandino (Managua) International Airport",
      "MNBL Bluefields Airport",
      "MNPC Puerto Cabezas Airport",
      "MNCI Corn Island Airport",
      "MNCE Costa Esmeralda Airport"
    ],
    "Niger": [
      "DRRN Diori Hamani International Airport",
      "DRZR Zinder Airport",
      "DRZA Mano Dayak International Airport",
      "DRRM Maradi Airport",
      "DRRT Tahoua Airport"
    ],
    "Nig\u00e9ria": [
      "DNEN Akanu Ibiam International Airport",
      "DNAS Asaba International Airport",
      "DNIL General Tunde Idiagbon International Airport",
      "DNKA Kaduna International Airport",
      "DNMA Maiduguri International Airport"
    ],
    "Niue": [
      "NIUE Niue International Airport"
    ],
    "Norv\u00e8ge": [
      "ENBR Bergen Airport, Flesland",
      "ENBO Bod\u00f8 Airport",
      "ENEV Harstad/Narvik Airport",
      "ENCN Kristiansand Airport",
      "ENGM Oslo-Gardermoen International Airport"
    ],
    "Nouvelle-Cal\u00e9donie": [
      "NWWW La Tontouta International Airport",
      "NWWD Kon\u00e9 Airport",
      "NWWL Lifou Airport",
      "NWWR Mar\u00e9 Airport",
      "NWWM Noum\u00e9a Magenta Airport"
    ],
    "Nouvelle-Z\u00e9lande": [
      "NZAA Auckland International Airport",
      "NZCH Christchurch International Airport",
      "NZQN Queenstown Airport",
      "NZWN Wellington International Airport",
      "NZDN Dunedin International Airport"
    ],
    "N\u00e9pal": [
      "VNBW Gautam Buddha International Airport",
      "VNKT Tribhuvan International Airport",
      "VNVT Biratnagar Airport",
      "VNJP Janakpur Airport",
      "VNNG Nepalgunj Airport"
    ],
    "Oman": [
      "OOMS Muscat International Airport",
      "OOSA Salalah International Airport",
      "OOSH Suhar International Airport",
      "OOKB Khasab Airport",
      "OOMA RAFO Masirah"
    ],
    "Ouganda": [
      "HUEN Entebbe International Airport",
      "HUAR Arua Airport",
      "HUGU Gulu Airport",
      "HUSO Soroti Airport",
      "HUAJ Adjumani Airport"
    ],
    "Ouzb\u00e9kistan": [
      "UZFA Andijan International Airport",
      "UZSB Bukhara International Airport",
      "UZFN Namangan International Airport",
      "UZSA Navoi International Airport",
      "UZNN Nukus International Airport"
    ],
    "Pakistan": [
      "OPLA Allama Iqbal International Airport",
      "OPPS Bacha Khan International Airport",
      "OPFA Faisalabad International Airport",
      "OPIS Islamabad International Airport",
      "OPKC Jinnah International Airport"
    ],
    "Palaos (Palau)": [
      "PTRO Roman Tmetuchl International Airport"
    ],
    "Panama": [
      "MPTO Tocumen International Airport",
      "MPCE Alonso Valderrama Airport",
      "MPBO Bocas del Toro \"Isla Col\u00f3n\" International Airport",
      "MPCH Changuinola Captain Manuel Ni\u00f1o International Airport",
      "MPEJ Enrique Adolfo Jimenez Airport"
    ],
    "Papouasie-Nouvelle-Guin\u00e9e": [
      "AYNZ Nadzab Tomodachi International Airport",
      "AYPY Port Moresby Jacksons International Airport",
      "AYBA Baimuru Airport",
      "AYBM Balimo Airport",
      "AYBK Buka Airport"
    ],
    "Paraguay": [
      "SGES Guaran\u00ed International Airport",
      "SGAS Silvio Pettirossi International Airport",
      "SGEN Teniente Ramon A. Ayub Gonzalez International Airport",
      "SGPJ Aeropuerto Nacional Dr. Augusto Roberto Fuster",
      "SGAY Aeropuerto Nacional Juan de Ayolas"
    ],
    "Pays-Bas": [
      "EHAM Amsterdam Airport Schiphol",
      "EHEH Eindhoven Airport",
      "EHGG Groningen Airport Eelde",
      "EHBK Maastricht Aachen Airport",
      "EHRD Rotterdam The Hague Airport"
    ],
    "Pays-Bas carib\u00e9ens": [
      "TNCB Flamingo International Airport",
      "TNCE F. D. Roosevelt Airport",
      "TNCS Juancho E. Yrausquin Airport"
    ],
    "Philippines": [
      "RPVB Bacolod-Silay International Airport",
      "RPLK Bicol International Airport",
      "RPLC Clark International Airport / Clark Air Base",
      "RPMD Francisco Bangoy International Airport",
      "RPMR General Santos International Airport"
    ],
    "Pologne": [
      "EPWR Copernicus Wroc\u0142aw Airport",
      "EPGD Gda\u0144sk Lech Wa\u0142\u0119sa Airport",
      "EPKT Katowice Wojciech Korfanty International Airport",
      "EPKK Krak\u00f3w John Paul II International Airport",
      "EPLB Lublin Airport"
    ],
    "Polyn\u00e9sie fran\u00e7aise": [
      "NTAA Fa'a'\u0101 International Airport",
      "NTHE Ahe Airport",
      "NTGA Anaa Airport",
      "NTGU Arutua Airport",
      "NTTB Bora Bora Airport"
    ],
    "Porto Rico": [
      "TJSJ Luis Munoz Marin International Airport",
      "TJVQ Antonio Rivera Rodriguez Airport",
      "TJCP Benjamin Rivera Noriega Airport",
      "TJMZ Eugenio Maria De Hostos Airport",
      "TJIG Fernando Luis Ribas Dominicci Airport"
    ],
    "Portugal": [
      "LPMA Cristiano Ronaldo International Airport",
      "LPFR Faro - Gago Coutinho International Airport",
      "LPPR Francisco de S\u00e1 Carneiro Airport",
      "LPPD Jo\u00e3o Paulo II Airport",
      "LPPT Lisbon Humberto Delgado Airport"
    ],
    "P\u00e9rou": [
      "SPZO Alejandro Velasco Astete International Airport",
      "SPCL Cap FAP David Abenzur Rengifo International Airport",
      "SPRU Capit\u00e1n FAP Carlos Mart\u00ednez de Pinillos International Airport",
      "SPHI Capit\u00e1n FAP Jos\u00e9 A. Qui\u00f1ones Gonz\u00e1lez International Airport",
      "SPQT Coronel FAP Francisco Secada Vignetta International Airport"
    ],
    "Qatar": [
      "OTBD Doha International Airport",
      "OTHH Hamad International Airport",
      "OTBH Al Udeid Air Base"
    ],
    "Roumanie": [
      "LRCL Avram Iancu Cluj International Airport",
      "LRBC Bac\u0103u George Enescu International  Airport",
      "LRBV Bra\u0219ov-Ghimbav International Airport",
      "LRBS Bucharest B\u0103neasa Aurel Vlaicu International Airport",
      "LROP Bucharest Henri Coand\u0103 International Airport"
    ],
    "Royaume-Uni": [
      "EGPD Aberdeen International Airport",
      "EGAA Belfast International Airport",
      "EGBB Birmingham Airport",
      "EGGD Bristol Airport",
      "EGFF Cardiff International Airport"
    ],
    "Russie": [
      "UNAA Abakan International Airport",
      "URMG Akhmat Kadyrov Grozny International Airport",
      "UNEE Alexei Leonov Kemerovo International Airport",
      "UOOO Alykel International Airport",
      "URWA Astrakhan Narimanovo Boris M. Kustodiev International Airport"
    ],
    "Rwanda": [
      "HRYR Kigali International Airport",
      "HRZA Kamembe Airport",
      "HRYG Gisenyi Airport",
      "HRYI Butare Airport",
      "HRYN Nemba Airport"
    ],
    "R\u00e9publique centrafricaine": [
      "FEFF Bangui M'Poko International Airport",
      "FEFT Berb\u00e9rati Airport",
      "FEFA Alindao Airport",
      "FEGM Bakouma Airport",
      "FEFM Bambari Airport"
    ],
    "R\u00e9publique dominicaine": [
      "MDLR Casa De Campo International Airport",
      "MDST Cibao International Airport",
      "MDSD Las Am\u00e9ricas International Airport",
      "MDPC Punta Cana International Airport",
      "MDPP Gregorio Luperon International Airport"
    ],
    "R\u00e9union": [
      "FMEE Roland Garros Airport",
      "FMEP Saint-Pierre Pierrefonds Airport"
    ],
    "Sahara Occidental": [
      "GMMH Dakhla Airport",
      "GMML Laayoune Hassan I International Airport",
      "GMMA Smara Airport"
    ],
    "Saint-Barth\u00e9lemy": [
      "TFFJ St. Jean Airport"
    ],
    "Saint-Christophe-et-Ni\u00e9v\u00e8s": [
      "TKPK Robert L. Bradshaw International Airport",
      "TKPN Vance W. Amory International Airport"
    ],
    "Saint-Marin": [
      "LIKD Torraccia Airfield"
    ],
    "Saint-Martin": [
      "TNCM Princess Juliana International Airport"
    ],
    "Saint-Pierre-et-Miquelon": [
      "LFVP Saint-Pierre Pointe-Blanche Airport",
      "LFVM Miquelon Airport"
    ],
    "Saint-Vincent-et-les-Grenadines": [
      "TVSA Argyle International Airport",
      "TVSC Canouan Airport",
      "TVSB J F Mitchell Airport",
      "TVSM Mustique Airport",
      "TVSU Union Island International Airport"
    ],
    "Sainte-H\u00e9l\u00e8ne, Ascension et Tristan da Cunha": [
      "FHAW RAF Ascension Island",
      "FHSH Saint Helena International Airport"
    ],
    "Sainte-Lucie": [
      "TLPL Hewanorra International Airport",
      "TLPC George F. L. Charles Airport"
    ],
    "Salvador": [
      "MSLP El Salvador International Airport Saint \u00d3scar Arnulfo Romero y Gald\u00e1mez",
      "MSSS Ilopango International Airport"
    ],
    "Samoa": [
      "NSFA Faleolo International Airport",
      "NSAU Asau Airport",
      "NSFI Fagali'i Airport",
      "NSMA Maota Airport"
    ],
    "Samoa am\u00e9ricaines": [
      "NSTU Pago Pago International Airport",
      "NSFQ Fitiuta Airport",
      "NSAS Ofu Airport"
    ],
    "Serbie": [
      "LYBE Belgrade Nikola Tesla Airport",
      "LYNI Ni\u0161 Constantine the Great Airport",
      "LYKV Morava Airport",
      "LYBT Batajnica Air Base",
      "LYUZ Ponikve Airport"
    ],
    "Seychelles": [
      "FSIA Seychelles International Airport",
      "FSPP Praslin Island Airport",
      "FSAL Alphonse Airport",
      "FSAS Assomption Airport",
      "FSSB Bird Island Airport"
    ],
    "Sierra Leone": [
      "GFLL Lungi International Airport",
      "GFBO Bo Airport",
      "GFKE Kenema Airport",
      "GFYE Yengema Airport",
      "GFGK Gbangbatok Airport"
    ],
    "Singapour": [
      "WSSS Singapore Changi Airport",
      "WSSL Seletar Airport",
      "WSAP Paya Lebar Air Base",
      "WSAT Tengah Air Base"
    ],
    "Slovaquie": [
      "LZIB M. R. \u0160tef\u00e1nik Airport",
      "LZKZ Ko\u0161ice International Airport",
      "LZTT Poprad-Tatry Airport",
      "LZSL Slia\u010d Airport",
      "LZMC Malacky/Kuchy\u0148a Air Base"
    ],
    "Slov\u00e9nie": [
      "LJLJ Ljubljana Jo\u017ee Pu\u010dnik Airport",
      "LJMB Maribor Edvard Rusjan Airport",
      "LJPZ Portoro\u017e Airport"
    ],
    "Somalie": [
      "HCMM Aden Adde International Airport",
      "HCMF Bender Qassim International Airport",
      "HCMH Egal International Airport",
      "HCMI Berbera Airport",
      "HCMN Beledweyne Airport"
    ],
    "Soudan": [
      "HSSK Khartoum International Airport",
      "HSPN Port Sudan New International Airport",
      "HSDN Dongola Airport",
      "HSFS El Fasher Airport",
      "HSOB El-Obeid Airport"
    ],
    "Soudan du Sud": [
      "HJJJ Juba International Airport",
      "HSSM Malakal International Airport",
      "HSRJ Raga Airport",
      "HSRN Renk Airport",
      "HSTO Tong Airport"
    ],
    "Sri Lanka": [
      "VCBI Bandaranaike International Colombo Airport",
      "VCCC Colombo Ratmalana International Airport",
      "VCCJ Jaffna International Airport",
      "VCRI Mattala Rajapaksa International Airport",
      "VCCB Batticaloa International Airport"
    ],
    "Suisse": [
      "LSGG Geneva Cointrin International Airport",
      "LSZH Z\u00fcrich Airport",
      "LSZB Bern Airport",
      "LSZA Lugano Airport",
      "LSZR Sankt Gallen Altenrhein Airport"
    ],
    "Surinam": [
      "SMJP Johan Adolf Pengel International Airport",
      "SMDA Drietabbetje Airport",
      "SMEG Eduard Alexander Gummels Airport",
      "SMMO Moengo Airstrip",
      "SMWA Wageningen Airstrip"
    ],
    "Su\u00e8de": [
      "ESGG G\u00f6teborg Landvetter Airport",
      "ESNQ Kiruna Airport",
      "ESSL Link\u00f6ping City Airport",
      "ESPA Lule\u00e5 Airport",
      "ESMS Malm\u00f6 Sturup Airport"
    ],
    "Swaziland": [
      "FDSK King Mswati III International Airport",
      "FDMS Matsapha International Airport",
      "FDKB Kubuta Airport",
      "FDMH Mhlume Airport",
      "FDNH Nhlangano Airport"
    ],
    "Syrie": [
      "OSAP Aleppo International Airport",
      "OSDI Damascus International Airport",
      "OSLK Latakia International Airport",
      "OSKL Qamishli International Airport",
      "OSDZ Deir ez-Zor Airport"
    ],
    "S\u00e3o Tom\u00e9 et Pr\u00edncipe": [
      "FPST S\u00e3o Tom\u00e9 International Airport",
      "FPPR Principe Airport"
    ],
    "S\u00e9n\u00e9gal": [
      "GOBD Blaise Diagne International Airport",
      "GOOY L\u00e9opold S\u00e9dar Senghor International Airport",
      "GOGS Cap Skirring Airport",
      "GOGG Ziguinchor Airport",
      "GOTB Bakel Airport"
    ],
    "Tadjikistan": [
      "UTDT Bokhtar International Airport",
      "UTDD Dushanbe International Airport",
      "UTDL Khujand International Airport",
      "UTDK Kulob International Airport"
    ],
    "Tanzanie": [
      "HTZA Abeid Amani Karume International Airport",
      "HTDA Julius Nyerere International Airport",
      "HTKJ Kilimanjaro International Airport",
      "HTMW Mwanza International Airport",
      "HTAR Arusha Airport"
    ],
    "Ta\u00efwan": [
      "RCYU Hualien Chiashan Airport",
      "RCKH Kaohsiung International Airport",
      "RCQC Penghu Magong Airport",
      "RCMQ Taichung International Airport / Ching Chuang Kang Air Base",
      "RCNN Tainan International Airport / Tainan Air Base"
    ],
    "Tchad": [
      "FTTJ N'Djamena International Airport",
      "FTTC Abeche Airport",
      "FTTY Faya-Largeau Airport",
      "FTTD Moundou Airport",
      "FTTN Am Timan Airport"
    ],
    "Tch\u00e9quie": [
      "LKKV Karlovy Vary Airport",
      "LKMT Leo\u0161 Jan\u00e1\u010dek Airport Ostrava",
      "LKPD Pardubice Airport",
      "LKPR V\u00e1clav Havel Airport Prague",
      "LKCS \u010cesk\u00e9 Bud\u011bjovice South Bohemian Airport"
    ],
    "Tha\u00eflande": [
      "VTCC Chiang Mai International Airport",
      "VTBD Don Mueang International Airport",
      "VTSS Hat Yai International Airport",
      "VTSG Krabi International Airport",
      "VTCT Mae Fah Luang - Chiang Rai International Airport"
    ],
    "Timor oriental": [
      "WPOC Oecusse Route of the Sandalwood International Airport",
      "WPDL Presidente Nicolau Lobato International Airport",
      "WPEC Baucau Airport",
      "WPDB Commander in Chief of FALINTIL, Kay Rala Xanana Gusm\u00e3o, International Airport",
      "WPAT Atauro Airport"
    ],
    "Togo": [
      "DXXX Lom\u00e9\u2013Tokoin International Airport",
      "DXNG Niamtougou International Airport",
      "DXAK Akpaka Airport",
      "DXDP Djangou Airport",
      "DXKP Kolokope Airport"
    ],
    "Tonga": [
      "NFTF Fua'amotu International Airport",
      "NFTV Vava'u International Airport",
      "NFTL Lifuka Island Airport",
      "NFTE Kaufana Airport",
      "NFTP Kuini Lavenia Airport"
    ],
    "Trinit\u00e9-et-Tobago": [
      "TTCP A.N.R. Robinson International Airport",
      "TTPP Piarco International Airport"
    ],
    "Tunisie": [
      "DTTJ Djerba Zarzis International Airport",
      "DTTX Sfax Thyna International Airport",
      "DTTA Tunis Carthage International Airport",
      "DTNH Enfidha - Hammamet International Airport",
      "DTTG Gab\u00e8s Matmata International Airport"
    ],
    "Turkm\u00e9nistan": [
      "UTAA Ashgabat International Airport",
      "UTAN Balkanabat International Airport",
      "UTAT Dashoguz International Airport",
      "UTAM Mary International Airport",
      "UTAV T\u00fcrkmenabat International Airport"
    ],
    "Turquie": [
      "LTAF Adana \u015eakirpa\u015fa Airport",
      "LTBJ Adnan Menderes International Airport",
      "LTAI Antalya International Airport",
      "LTFD Bal\u0131kesir Koca Seyit Airport",
      "LTBS Dalaman International Airport"
    ],
    "Tuvalu": [
      "NGFU Funafuti International Airport"
    ],
    "Ukraine": [
      "UKLL Lviv International Airport",
      "UKFF Simferopol International Airport",
      "UKLU Uzhhorod International Airport",
      "UKLN Chernivtsi International Airport",
      "UKDD Dnipro International Airport"
    ],
    "Uruguay": [
      "SUMU Carrasco General Ces\u00e1reo L. Berisso International Airport",
      "SULS Capitan Corbeta CA Curbelo International Airport",
      "SURV Pres. Gral. \u00d3scar D. Gestido Binational Airport",
      "SUSO Nueva Hesperides International Airport",
      "SUDU Santa Bernardina International Airport"
    ],
    "Vanuatu": [
      "NVVV Bauerfield International Airport",
      "NVSS Santo Pekoa International Airport",
      "NVVW Whitegrass Airport",
      "NVSF Craig Cove Airport",
      "NVVF Futuna Airport"
    ],
    "Venezuela": [
      "SVVA Arturo Michelena International Airport",
      "SVMG Del Caribe Santiago Mari\u00f1o International Airport",
      "SVBC General Jos\u00e9 Antonio Anzoategui International Airport",
      "SVPR General Manuel Carlos Piar International Airport",
      "SVBM Jacinto Lara International Airport"
    ],
    "Vi\u00eat Nam": [
      "VVCR Cam Ranh International Airport / Cam Ranh Air Base",
      "VVCT Can Tho International Airport",
      "VVCI Cat Bi International Airport",
      "VVDN Da Nang International Airport",
      "VVNB Noi Bai International Airport"
    ],
    "Wallis-et-Futuna": [
      "NLWW Hihifo Airport",
      "NLWF Pointe Vele Airport"
    ],
    "Y\u00e9men": [
      "OYAA Aden International Airport",
      "OYMK Mokha International Airport",
      "OYRN Riyan International Airport",
      "OYSN Sanaa International Airport",
      "OYSY Seiyun Hadhramaut International Airport"
    ],
    "Zambie": [
      "FLHN Harry Mwanga Nkumbula International Airport",
      "FLKK Kenneth Kaunda International Airport",
      "FLMF Mfuwe International Airport",
      "FLSK Simon Mwansa Kapwepwe International Airport",
      "FLND Peter Zuze Air Force Base"
    ],
    "Zimbabwe": [
      "FVJN Joshua Mqabuko Nkomo International Airport",
      "FVFA Victoria Falls International Airport",
      "FVKB Kariba Airport",
      "FVCZ Buffalo Range Airport",
      "FVWN Hwange National Park Airport"
    ],
    "\u00c9gypte": [
      "HEAX Alexandria International Airport",
      "HESN Aswan International Airport",
      "HEAT Asyut International Airport",
      "HECA Cairo International Airport",
      "HECP Capital International Airport"
    ],
    "\u00c9mirats arabes unis": [
      "OMAL Al Ain International Airport",
      "OMDW Al Maktoum International Airport",
      "OMDB Dubai International Airport",
      "OMFJ Fujairah International Airport",
      "OMRK Ras Al Khaimah International Airport"
    ],
    "\u00c9quateur": [
      "SETN Carlos Concha Torres International Airport",
      "SESA General Ulpiano Paez International Airport",
      "SEGU Jos\u00e9 Joaqu\u00edn de Olmedo International Airport",
      "SEQM Mariscal Sucre International Airport",
      "SEMC Coronel E Carvajal Airport"
    ],
    "\u00c9rythr\u00e9e": [
      "HHAS Asmara International Airport",
      "HHSB Assab International Airport",
      "HHMS Massawa International Airport",
      "HHAG Agordat Airport",
      "HHTS Tessenei Airport"
    ],
    "\u00c9tats-Unis": [
      "KALB Albany International Airport",
      "KABQ Albuquerque International Sunport",
      "KAUS Austin Bergstrom International Airport",
      "KBWI Baltimore/Washington International Thurgood Marshall Airport",
      "KBHM Birmingham-Shuttlesworth International Airport"
    ],
    "\u00c9thiopie": [
      "HADR Aba Tenna Dejazmach Yilma International Airport",
      "HAAB Addis Ababa Bole International Airport",
      "HAJJ Gerad Wilwal International Airport",
      "HALA Hawassa International Airport",
      "HAAM Arba Minch Airport"
    ],
    "\u00cele Christmas": [
      "YPXM Christmas Island International Airport"
    ],
    "\u00cele de Man": [
      "EGNS Isle of Man Airport"
    ],
    "\u00cele Maurice": [
      "FIMP Sir Seewoosagur Ramgoolam International Airport",
      "FIMR Sir Charles Gaetan Duval Airport"
    ],
    "\u00cele Norfolk": [
      "YSNF Norfolk Island International Airport"
    ],
    "\u00celes Ca\u00efmans": [
      "MWCR Owen Roberts International Airport",
      "MWCB Charles Kirkconnell International Airport",
      "MWCL Edward Bodden Little Cayman Airfield"
    ],
    "\u00celes Cocos": [
      "YPCC Cocos (Keeling) Islands Airport"
    ],
    "\u00celes Cook": [
      "NCRG Rarotonga International Airport",
      "NCAI Aitutaki Airport",
      "NCAT Enua Airport",
      "NCMH Manihiki Island Airport",
      "NCMK Mauke Airport"
    ],
    "\u00celes du Cap-Vert": [
      "GVAC Am\u00edlcar Cabral International Airport",
      "GVBA Aristides Pereira International Airport",
      "GVSV Cesaria Evora International Airport",
      "GVNP Nelson Mandela International Airport",
      "GVMA Maio Airport"
    ],
    "\u00celes F\u00e9ro\u00e9": [
      "EKVG V\u00e1gar Airport"
    ],
    "\u00celes Malouines": [
      "EGYP Mount Pleasant Airport / RAF Mount Pleasant",
      "SFAL Port Stanley Airport"
    ],
    "\u00celes Mariannes du Nord": [
      "PGRO Rota International Airport",
      "PGSN Saipan International Airport",
      "PGWT Tinian International Airport"
    ],
    "\u00celes Marshall": [
      "PKMJ Marshall Islands International Airport",
      "PKWA Bucholz Army Air Field",
      "PKMA Eniwetok Airport",
      "PKRO Dyess Army Air Field"
    ],
    "\u00celes mineures \u00e9loign\u00e9es des \u00c9tats-Unis": [
      "PWAK Wake Island Airfield",
      "PMDY Henderson Field",
      "PLPA Palmyra (Cooper) Airport"
    ],
    "\u00celes Salomon": [
      "AGGH Honiara International Airport",
      "AGGM Munda Airport",
      "AGGE Ballalae Airport",
      "AGGB Bellona/Anua Airport",
      "AGGC Choiseul Bay Airport"
    ],
    "\u00celes Turques-et-Ca\u00efques": [
      "MBPV Providenciales International Airport",
      "MBGT JAGS McCartney International Airport",
      "MBNC North Caicos Airport",
      "MBSC South Caicos Airport",
      "MBSY Salt Cay Airport"
    ],
    "\u00celes Vierges britanniques": [
      "TUPJ Terrance B. Lettsome International Airport",
      "TUPW Virgin Gorda Airport",
      "TUPA Captain Auguste George Airport"
    ],
    "\u00celes Vierges des \u00c9tats-Unis": [
      "TIST Cyril E. King Airport",
      "TISX Henry E. Rohlsen Airport"
    ]
  }
};

