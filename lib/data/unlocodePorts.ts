export type UnlocodePort = {
  code: string
  countryCode: string
  countryName: string
  name: string
}

export const UNLOCODE_PORTS: UnlocodePort[] = [
  { code: "INNSA", countryCode: "IN", countryName: "India", name: "Nhava Sheva" },
  { code: "INMUN", countryCode: "IN", countryName: "India", name: "Mundra" },
  { code: "INBOM", countryCode: "IN", countryName: "India", name: "Mumbai" },
  { code: "INMAA", countryCode: "IN", countryName: "India", name: "Chennai" },
  { code: "INKAT", countryCode: "IN", countryName: "India", name: "Kattupalli" },
  { code: "INKOC", countryCode: "IN", countryName: "India", name: "Cochin" },
  { code: "INVTZ", countryCode: "IN", countryName: "India", name: "Visakhapatnam" },
  { code: "INCCU", countryCode: "IN", countryName: "India", name: "Kolkata" },
  { code: "INHAL", countryCode: "IN", countryName: "India", name: "Haldia" },
  { code: "INGOI", countryCode: "IN", countryName: "India", name: "Mormugao" },
  { code: "INPAV", countryCode: "IN", countryName: "India", name: "Pipavav" },
  { code: "INNML", countryCode: "IN", countryName: "India", name: "New Mangalore" },
  { code: "INDAH", countryCode: "IN", countryName: "India", name: "Dahej" },
  { code: "INTUT", countryCode: "IN", countryName: "India", name: "Tuticorin" },
  { code: "INKRI", countryCode: "IN", countryName: "India", name: "Krishnapatnam" },
  { code: "INBHU", countryCode: "IN", countryName: "India", name: "Bhavnagar" },
  { code: "INMRM", countryCode: "IN", countryName: "India", name: "Marmugao" },
  { code: "INPNQ", countryCode: "IN", countryName: "India", name: "Panaji" },
  { code: "INJNP", countryCode: "IN", countryName: "India", name: "Jawaharlal Nehru Port" },
  { code: "INBID", countryCode: "IN", countryName: "India", name: "Bedi" },
  { code: "INOKH", countryCode: "IN", countryName: "India", name: "Okha" },
  { code: "INTEH", countryCode: "IN", countryName: "India", name: "Tezpur Harbour" },
  { code: "INKND", countryCode: "IN", countryName: "India", name: "Kandla" },
  { code: "INSXR", countryCode: "IN", countryName: "India", name: "Sikka" },
  { code: "INMRA", countryCode: "IN", countryName: "India", name: "Mora" },

  { code: "SGSIN", countryCode: "SG", countryName: "Singapore", name: "Singapore" },

  { code: "CNSHA", countryCode: "CN", countryName: "China", name: "Shanghai" },
  { code: "CNNGB", countryCode: "CN", countryName: "China", name: "Ningbo" },
  { code: "CNQDG", countryCode: "CN", countryName: "China", name: "Qingdao" },
  { code: "CNTXG", countryCode: "CN", countryName: "China", name: "Tianjin Xingang" },
  { code: "CNSZX", countryCode: "CN", countryName: "China", name: "Shenzhen" },
  { code: "CNXMN", countryCode: "CN", countryName: "China", name: "Xiamen" },
  { code: "CNFOC", countryCode: "CN", countryName: "China", name: "Fuzhou" },
  { code: "CNTAO", countryCode: "CN", countryName: "China", name: "Qingdao" },
  { code: "CNDLC", countryCode: "CN", countryName: "China", name: "Dalian" },
  { code: "CNNAN", countryCode: "CN", countryName: "China", name: "Nansha" },
  { code: "CNYTN", countryCode: "CN", countryName: "China", name: "Yantian" },
  { code: "CNHUA", countryCode: "CN", countryName: "China", name: "Huangpu" },
  { code: "CNRIZ", countryCode: "CN", countryName: "China", name: "Rizhao" },
  { code: "CNLYG", countryCode: "CN", countryName: "China", name: "Lianyungang" },
  { code: "CNWUH", countryCode: "CN", countryName: "China", name: "Wuhan" },

  { code: "HKHKG", countryCode: "HK", countryName: "Hong Kong", name: "Hong Kong" },

  { code: "KRPUS", countryCode: "KR", countryName: "South Korea", name: "Busan" },
  { code: "KRINC", countryCode: "KR", countryName: "South Korea", name: "Incheon" },
  { code: "KRKAN", countryCode: "KR", countryName: "South Korea", name: "Gwangyang" },
  { code: "KRUSN", countryCode: "KR", countryName: "South Korea", name: "Ulsan" },

  { code: "JPTYO", countryCode: "JP", countryName: "Japan", name: "Tokyo" },
  { code: "JPYOK", countryCode: "JP", countryName: "Japan", name: "Yokohama" },
  { code: "JPKOB", countryCode: "JP", countryName: "Japan", name: "Kobe" },
  { code: "JPOSA", countryCode: "JP", countryName: "Japan", name: "Osaka" },
  { code: "JPNGO", countryCode: "JP", countryName: "Japan", name: "Nagoya" },
  { code: "JPHKT", countryCode: "JP", countryName: "Japan", name: "Hakata" },

  { code: "MYTPP", countryCode: "MY", countryName: "Malaysia", name: "Port Klang" },
  { code: "MYPEN", countryCode: "MY", countryName: "Malaysia", name: "Penang" },
  { code: "MYBKI", countryCode: "MY", countryName: "Malaysia", name: "Kota Kinabalu" },
  { code: "MYKCH", countryCode: "MY", countryName: "Malaysia", name: "Kuching" },
  { code: "MYJHB", countryCode: "MY", countryName: "Malaysia", name: "Johor Bahru" },

  { code: "IDTPP", countryCode: "ID", countryName: "Indonesia", name: "Tanjung Priok" },
  { code: "IDSUB", countryCode: "ID", countryName: "Indonesia", name: "Surabaya" },
  { code: "IDBLW", countryCode: "ID", countryName: "Indonesia", name: "Belawan" },
  { code: "IDSRG", countryCode: "ID", countryName: "Indonesia", name: "Semarang" },
  { code: "IDMKS", countryCode: "ID", countryName: "Indonesia", name: "Makassar" },

  { code: "THLCH", countryCode: "TH", countryName: "Thailand", name: "Laem Chabang" },
  { code: "THBKK", countryCode: "TH", countryName: "Thailand", name: "Bangkok" },
  { code: "THSKA", countryCode: "TH", countryName: "Thailand", name: "Songkhla" },

  { code: "VNSGN", countryCode: "VN", countryName: "Vietnam", name: "Ho Chi Minh City" },
  { code: "VNHPH", countryCode: "VN", countryName: "Vietnam", name: "Hai Phong" },
  { code: "VNDAD", countryCode: "VN", countryName: "Vietnam", name: "Da Nang" },
  { code: "VNCLI", countryCode: "VN", countryName: "Vietnam", name: "Cat Lai" },

  { code: "PHMNL", countryCode: "PH", countryName: "Philippines", name: "Manila" },
  { code: "PHCEB", countryCode: "PH", countryName: "Philippines", name: "Cebu" },
  { code: "PHDVO", countryCode: "PH", countryName: "Philippines", name: "Davao" },

  { code: "AUSYD", countryCode: "AU", countryName: "Australia", name: "Sydney" },
  { code: "AUMEL", countryCode: "AU", countryName: "Australia", name: "Melbourne" },
  { code: "AUBNE", countryCode: "AU", countryName: "Australia", name: "Brisbane" },
  { code: "AUFRE", countryCode: "AU", countryName: "Australia", name: "Fremantle" },
  { code: "AUADL", countryCode: "AU", countryName: "Australia", name: "Adelaide" },

  { code: "NZAKL", countryCode: "NZ", countryName: "New Zealand", name: "Auckland" },
  { code: "NZWLG", countryCode: "NZ", countryName: "New Zealand", name: "Wellington" },
  { code: "NZCHC", countryCode: "NZ", countryName: "New Zealand", name: "Christchurch" },
  { code: "NZTRG", countryCode: "NZ", countryName: "New Zealand", name: "Tauranga" },

  { code: "NLRTM", countryCode: "NL", countryName: "Netherlands", name: "Rotterdam" },
  { code: "NLAMS", countryCode: "NL", countryName: "Netherlands", name: "Amsterdam" },
  { code: "NLVLI", countryCode: "NL", countryName: "Netherlands", name: "Vlissingen" },

  { code: "BEANR", countryCode: "BE", countryName: "Belgium", name: "Antwerp" },
  { code: "BEZEE", countryCode: "BE", countryName: "Belgium", name: "Zeebrugge" },
  { code: "BEGNE", countryCode: "BE", countryName: "Belgium", name: "Ghent" },

  { code: "DEHAM", countryCode: "DE", countryName: "Germany", name: "Hamburg" },
  { code: "DEBRV", countryCode: "DE", countryName: "Germany", name: "Bremerhaven" },
  { code: "DEWVN", countryCode: "DE", countryName: "Germany", name: "Wilhelmshaven" },

  { code: "FRLEH", countryCode: "FR", countryName: "France", name: "Le Havre" },
  { code: "FRMRS", countryCode: "FR", countryName: "France", name: "Marseille" },
  { code: "FRDKK", countryCode: "FR", countryName: "France", name: "Dunkerque" },

  { code: "ESALG", countryCode: "ES", countryName: "Spain", name: "Algeciras" },
  { code: "ESBCN", countryCode: "ES", countryName: "Spain", name: "Barcelona" },
  { code: "ESVLC", countryCode: "ES", countryName: "Spain", name: "Valencia" },
  { code: "ESBIO", countryCode: "ES", countryName: "Spain", name: "Bilbao" },

  { code: "PTLIS", countryCode: "PT", countryName: "Portugal", name: "Lisbon" },
  { code: "PTLEI", countryCode: "PT", countryName: "Portugal", name: "Leixoes" },
  { code: "PTSIE", countryCode: "PT", countryName: "Portugal", name: "Sines" },

  { code: "ITGOA", countryCode: "IT", countryName: "Italy", name: "Genoa" },
  { code: "ITTRS", countryCode: "IT", countryName: "Italy", name: "Trieste" },
  { code: "ITLIV", countryCode: "IT", countryName: "Italy", name: "Livorno" },
  { code: "ITNAP", countryCode: "IT", countryName: "Italy", name: "Naples" },
  { code: "ITVCE", countryCode: "IT", countryName: "Italy", name: "Venice" },

  { code: "GRPIR", countryCode: "GR", countryName: "Greece", name: "Piraeus" },
  { code: "GRSKG", countryCode: "GR", countryName: "Greece", name: "Thessaloniki" },

  { code: "TRIST", countryCode: "TR", countryName: "Turkey", name: "Istanbul" },
  { code: "TRIZM", countryCode: "TR", countryName: "Turkey", name: "Izmir" },
  { code: "TRMER", countryCode: "TR", countryName: "Turkey", name: "Mersin" },

  { code: "GBFXT", countryCode: "GB", countryName: "United Kingdom", name: "Felixstowe" },
  { code: "GBSOU", countryCode: "GB", countryName: "United Kingdom", name: "Southampton" },
  { code: "GBLIV", countryCode: "GB", countryName: "United Kingdom", name: "Liverpool" },
  { code: "GBLGP", countryCode: "GB", countryName: "United Kingdom", name: "London Gateway" },

  { code: "IEORK", countryCode: "IE", countryName: "Ireland", name: "Cork" },
  { code: "IEDUB", countryCode: "IE", countryName: "Ireland", name: "Dublin" },

  { code: "NOOSL", countryCode: "NO", countryName: "Norway", name: "Oslo" },
  { code: "NOBGO", countryCode: "NO", countryName: "Norway", name: "Bergen" },

  { code: "SESTO", countryCode: "SE", countryName: "Sweden", name: "Stockholm" },
  { code: "SEGOT", countryCode: "SE", countryName: "Sweden", name: "Gothenburg" },

  { code: "DKCPH", countryCode: "DK", countryName: "Denmark", name: "Copenhagen" },
  { code: "DKAAR", countryCode: "DK", countryName: "Denmark", name: "Aarhus" },

  { code: "FIRAU", countryCode: "FI", countryName: "Finland", name: "Rauma" },
  { code: "FIHEL", countryCode: "FI", countryName: "Finland", name: "Helsinki" },

  { code: "PLGDN", countryCode: "PL", countryName: "Poland", name: "Gdansk" },
  { code: "PLGDY", countryCode: "PL", countryName: "Poland", name: "Gdynia" },

  { code: "RUVVO", countryCode: "RU", countryName: "Russia", name: "Vladivostok" },
  { code: "RULED", countryCode: "RU", countryName: "Russia", name: "Saint Petersburg" },
  { code: "RUNVS", countryCode: "RU", countryName: "Russia", name: "Novorossiysk" },

  { code: "AEJEA", countryCode: "AE", countryName: "United Arab Emirates", name: "Jebel Ali" },
  { code: "AEDXB", countryCode: "AE", countryName: "United Arab Emirates", name: "Dubai" },
  { code: "AESHJ", countryCode: "AE", countryName: "United Arab Emirates", name: "Sharjah" },
  { code: "AEAUH", countryCode: "AE", countryName: "United Arab Emirates", name: "Abu Dhabi" },
  { code: "AEFJR", countryCode: "AE", countryName: "United Arab Emirates", name: "Fujairah" },

  { code: "QAHMD", countryCode: "QA", countryName: "Qatar", name: "Hamad" },

  { code: "OMSLL", countryCode: "OM", countryName: "Oman", name: "Salalah" },
  { code: "OMSOH", countryCode: "OM", countryName: "Oman", name: "Sohar" },
  { code: "OMMCT", countryCode: "OM", countryName: "Oman", name: "Muscat" },

  { code: "BHBAH", countryCode: "BH", countryName: "Bahrain", name: "Bahrain" },

  { code: "KWKWI", countryCode: "KW", countryName: "Kuwait", name: "Kuwait" },

  { code: "SADMM", countryCode: "SA", countryName: "Saudi Arabia", name: "Dammam" },
  { code: "SAJED", countryCode: "SA", countryName: "Saudi Arabia", name: "Jeddah" },
  { code: "SAYNB", countryCode: "SA", countryName: "Saudi Arabia", name: "Yanbu" },

  { code: "IQBSR", countryCode: "IQ", countryName: "Iraq", name: "Basra" },

  { code: "IRBND", countryCode: "IR", countryName: "Iran", name: "Bandar Abbas" },
  { code: "IRKHO", countryCode: "IR", countryName: "Iran", name: "Khorramshahr" },

  { code: "EGALY", countryCode: "EG", countryName: "Egypt", name: "Alexandria" },
  { code: "EGPSD", countryCode: "EG", countryName: "Egypt", name: "Port Said" },
  { code: "EGSUZ", countryCode: "EG", countryName: "Egypt", name: "Suez" },
  { code: "EGDAM", countryCode: "EG", countryName: "Egypt", name: "Damietta" },

  { code: "MACAS", countryCode: "MA", countryName: "Morocco", name: "Casablanca" },
  { code: "MATNG", countryCode: "MA", countryName: "Morocco", name: "Tangier Med" },

  { code: "DZALG", countryCode: "DZ", countryName: "Algeria", name: "Algiers" },

  { code: "TNTUN", countryCode: "TN", countryName: "Tunisia", name: "Tunis" },

  { code: "NGLAG", countryCode: "NG", countryName: "Nigeria", name: "Lagos" },
  { code: "NGPHC", countryCode: "NG", countryName: "Nigeria", name: "Port Harcourt" },

  { code: "GHACC", countryCode: "GH", countryName: "Ghana", name: "Accra" },
  { code: "GHTEM", countryCode: "GH", countryName: "Ghana", name: "Tema" },

  { code: "CIABJ", countryCode: "CI", countryName: "Cote d'Ivoire", name: "Abidjan" },

  { code: "CMDLA", countryCode: "CM", countryName: "Cameroon", name: "Douala" },

  { code: "KEMBA", countryCode: "KE", countryName: "Kenya", name: "Mombasa" },

  { code: "TZDAR", countryCode: "TZ", countryName: "Tanzania", name: "Dar es Salaam" },

  { code: "ZADUR", countryCode: "ZA", countryName: "South Africa", name: "Durban" },
  { code: "ZACPT", countryCode: "ZA", countryName: "South Africa", name: "Cape Town" },
  { code: "ZAPEL", countryCode: "ZA", countryName: "South Africa", name: "Port Elizabeth" },
  { code: "ZARCB", countryCode: "ZA", countryName: "South Africa", name: "Richards Bay" },

  { code: "USLAX", countryCode: "US", countryName: "United States", name: "Los Angeles" },
  { code: "USLGB", countryCode: "US", countryName: "United States", name: "Long Beach" },
  { code: "USOAK", countryCode: "US", countryName: "United States", name: "Oakland" },
  { code: "USSEA", countryCode: "US", countryName: "United States", name: "Seattle" },
  { code: "USTIW", countryCode: "US", countryName: "United States", name: "Tacoma" },
  { code: "USPDX", countryCode: "US", countryName: "United States", name: "Portland" },
  { code: "USHNL", countryCode: "US", countryName: "United States", name: "Honolulu" },
  { code: "USNYC", countryCode: "US", countryName: "United States", name: "New York" },
  { code: "USNWK", countryCode: "US", countryName: "United States", name: "Newark" },
  { code: "USBOS", countryCode: "US", countryName: "United States", name: "Boston" },
  { code: "USBAL", countryCode: "US", countryName: "United States", name: "Baltimore" },
  { code: "USPHL", countryCode: "US", countryName: "United States", name: "Philadelphia" },
  { code: "USCHS", countryCode: "US", countryName: "United States", name: "Charleston" },
  { code: "USSAV", countryCode: "US", countryName: "United States", name: "Savannah" },
  { code: "USJAX", countryCode: "US", countryName: "United States", name: "Jacksonville" },
  { code: "USMIA", countryCode: "US", countryName: "United States", name: "Miami" },
  { code: "USHOU", countryCode: "US", countryName: "United States", name: "Houston" },
  { code: "USMSY", countryCode: "US", countryName: "United States", name: "New Orleans" },
  { code: "USMOB", countryCode: "US", countryName: "United States", name: "Mobile" },
  { code: "USNFK", countryCode: "US", countryName: "United States", name: "Norfolk" },

  { code: "CAVAN", countryCode: "CA", countryName: "Canada", name: "Vancouver" },
  { code: "CAPRR", countryCode: "CA", countryName: "Canada", name: "Prince Rupert" },
  { code: "CAMTR", countryCode: "CA", countryName: "Canada", name: "Montreal" },
  { code: "CAHAL", countryCode: "CA", countryName: "Canada", name: "Halifax" },
  { code: "CASJB", countryCode: "CA", countryName: "Canada", name: "Saint John" },

  { code: "MXZLO", countryCode: "MX", countryName: "Mexico", name: "Manzanillo" },
  { code: "MXVER", countryCode: "MX", countryName: "Mexico", name: "Veracruz" },
  { code: "MXATM", countryCode: "MX", countryName: "Mexico", name: "Altamira" },

  { code: "GTSTC", countryCode: "GT", countryName: "Guatemala", name: "Santo Tomas de Castilla" },

  { code: "PABLB", countryCode: "PA", countryName: "Panama", name: "Balboa" },
  { code: "PACOL", countryCode: "PA", countryName: "Panama", name: "Colon" },

  { code: "COCTG", countryCode: "CO", countryName: "Colombia", name: "Cartagena" },
  { code: "COBAQ", countryCode: "CO", countryName: "Colombia", name: "Barranquilla" },

  { code: "PECAL", countryCode: "PE", countryName: "Peru", name: "Callao" },

  { code: "CLVAP", countryCode: "CL", countryName: "Chile", name: "Valparaiso" },
  { code: "CLSAI", countryCode: "CL", countryName: "Chile", name: "San Antonio" },

  { code: "ECGYE", countryCode: "EC", countryName: "Ecuador", name: "Guayaquil" },

  { code: "BRSSZ", countryCode: "BR", countryName: "Brazil", name: "Santos" },
  { code: "BRRIO", countryCode: "BR", countryName: "Brazil", name: "Rio de Janeiro" },
  { code: "BRPNG", countryCode: "BR", countryName: "Brazil", name: "Paranagua" },
  { code: "BRITJ", countryCode: "BR", countryName: "Brazil", name: "Itajai" },
  { code: "BRSSA", countryCode: "BR", countryName: "Brazil", name: "Salvador" },
  { code: "BRSUA", countryCode: "BR", countryName: "Brazil", name: "Suape" },

  { code: "ARBUE", countryCode: "AR", countryName: "Argentina", name: "Buenos Aires" },
  { code: "ARRGL", countryCode: "AR", countryName: "Argentina", name: "Rosario" },

  { code: "UYMVD", countryCode: "UY", countryName: "Uruguay", name: "Montevideo" },

  { code: "PYASU", countryCode: "PY", countryName: "Paraguay", name: "Asuncion" },

  { code: "ILHFA", countryCode: "IL", countryName: "Israel", name: "Haifa" },
  { code: "ILASH", countryCode: "IL", countryName: "Israel", name: "Ashdod" },

  { code: "LBBEY", countryCode: "LB", countryName: "Lebanon", name: "Beirut" },

  { code: "JOAQJ", countryCode: "JO", countryName: "Jordan", name: "Aqaba" },

  { code: "PKKHI", countryCode: "PK", countryName: "Pakistan", name: "Karachi" },
  { code: "PKBQM", countryCode: "PK", countryName: "Pakistan", name: "Qasim" },
  { code: "PKGWD", countryCode: "PK", countryName: "Pakistan", name: "Gwadar" },

  { code: "LKCMB", countryCode: "LK", countryName: "Sri Lanka", name: "Colombo" },
  { code: "LKHBA", countryCode: "LK", countryName: "Sri Lanka", name: "Hambantota" },

  { code: "BDCGP", countryCode: "BD", countryName: "Bangladesh", name: "Chittagong" },
  { code: "BDMGL", countryCode: "BD", countryName: "Bangladesh", name: "Mongla" },

  { code: "MMRGN", countryCode: "MM", countryName: "Myanmar", name: "Yangon" },

  { code: "KHKOS", countryCode: "KH", countryName: "Cambodia", name: "Sihanoukville" },

  { code: "LAVTE", countryCode: "LA", countryName: "Laos", name: "Vientiane" },

  { code: "BNSER", countryCode: "BN", countryName: "Brunei", name: "Seria" },

  { code: "TWTXG", countryCode: "TW", countryName: "Taiwan", name: "Taichung" },
  { code: "TWKHH", countryCode: "TW", countryName: "Taiwan", name: "Kaohsiung" },
  { code: "TWKEL", countryCode: "TW", countryName: "Taiwan", name: "Keelung" },
  { code: "TWTPE", countryCode: "TW", countryName: "Taiwan", name: "Taipei" },
]
