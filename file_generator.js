
const request = require('request')
const fs = require('fs');

/* 
 * Need to be installed -- Can be switched to another ZIP module. 
 * If switched, please change "Unzip the file" part
*/
const admzip = require('adm-zip')

const version = 638;
const url = `http://www.codage.ext.cnamts.fr/f_mediam/fo/tips/LPPTOT${version}.zip`;


request(url)
    .pipe(fs.createWriteStream(`LPPTOT${version}.zip`))
    .on('close', function(){

        // Unzip the file.
        let zipped = new admzip(`LPPTOT${version}.zip`);
        zipped.extractAllTo('.', true);
        fs.unlinkSync(`LPPTOT${version}.zip`);

        // Read the unzipped file.
        let fileData = fs.readFileSync(`./LPPTOT${version}`).toString(); // LPPTOT595
        fs.unlinkSync(`LPPTOT${version}`);

        
        // Check weither is on single line or multiple and split it.
        let fileArray = []
        if ( fileData.search('\n') !== -1 ) fileArray = fileData.split('\n')
        else fileArray = fileData.match(/.{1,128}/g);

        let currLPP;
        let lpps = []
        let currLPPRow = 0

        fileArray.forEach( (row, i) => {

            // The line is under 128 Char long.
            if ( row.length < 128 ) {
                console.log('Error on line : ' + row)
            }

            // Add count to total LPP Count.
            currLPPRow ++

            // Jump the first row
            if ( i === 0 ) return

            // Create new LPP with type 101.
            if ( row.startsWith('101') ){
                if ( row.startsWith('1010101')){
                    currLPPRow = 1
                    currLPP = new LPP(parseInt(row.substr(7, 13).replace( / {1,}$/, '')), row.substr(20, 80).replace( / {1,}$/, ''))
                } else {
                    currLPP.set101(row.substr(7, 8), row.substr(15, 3), row.substr(18, 1))
                }
            } 
            
            // Add period to previous created LPP Code.
            else if ( row.startsWith('11001') ){
                currLPP.setPeriod(row.substr(7, 8), row.substr(15, 8),
                row.substr(23, 3), row.substr(26, 1), row.substr(44, 10), row.substr(54, 24),
                    row.substr(78, 3), row.substr(81, 10), row.substr(91, 10))
            } 
            
            // Check if the whole LPP Code file is correct by comparing total LPP Code created.
            else if ( row.startsWith('1990101')){
                if ( currLPP.checkLPP(row.substr(7, 5), currLPPRow) ) lpps.push(currLPP)
            } 
            
            // End of the file. Doing some length validation to be sure file is correct.
            else if ( row.startsWith('999')){
                console.log(`Checking file validity :  \r
                - Count of row : ${fileArray.length} \r
                - Row checksum: ${parseInt(row.substr(52, 8))} \r
                - Validated : ${fileArray.length === parseInt(row.substr(52, 8)) ?  'YES' : 'NO'} \r
                - LPP Code count : ${lpps.length} \r
                - Checksum LPP : ${parseInt(row.substr(60, 6))} \r
                - Validated : ${lpps.length === parseInt(row.substr(60, 6)) ? 'YES' : 'NO'} `)
            }
        })
        
        let result = {}
        lpps.forEach( lpp => {
            result[lpp.code] = lpp
        })
        
        fs.writeFileSync(`./lpp_${version}.json`, JSON.stringify(result))
    })

class LPP {
    /**
     * Create a new LPP
     * @param code : String - The LPP Code
     * @param libelle : String - The LPP Name
     * @returns {LPP} : LPP - New LPP
     */
    constructor(code, libelle) {
        this.name = libelle
        this.code = code;
        return this
    }

    /**
     * Set the first record of the LPP
     * @param dateFin : String - The validity end date of LPP Code
     * @param ageMax : String - The max age for this LPP Code
     * @param typePresta : String - The type of prestation
     */
    set101(dateFin, ageMax, typePresta){
        this.endDate = dateFin !== "00000000" ? new Date(`${dateFin.substr(0, 4)}-${dateFin.substr(4, 2)}-${dateFin.substr(6, 2)}`) : ""
        this.maxAge = parseInt(ageMax) !== 0 ? parseInt(ageMax) : ""
        this.type = typePresta
    }

    /**
     * Create a new LPP Period
     * @param dateDebut : String - The start date of period
     * @param dateFin : String - The end date of period
     * @param naturePrestation : String - The nature of prestation for this period
     * @param topPreAprouval : String - If the LPP is conditioner by pre-approuval
     * @param tarifReference : String - The tariff for the period
     * @param majorationDom : String - The multiplicand if DOM
     * @param quantiteMax : String - The max quantity
     * @param montantMax : String - The max price
     * @param prixUnitaireReglementer : String - The regulated price
     */
    setPeriod(dateDebut, dateFin, naturePrestation, topEntentePrealable,
              tarifReference, majorationDom, quantiteMax, montantMax,
              prixUnitaireReglementer){
        if ( this.periods === undefined){
            this.periods = new Array()
        }

        this.periods.push( {
            'startDate':  new Date(`${dateDebut.substr(0, 4)}-${dateDebut.substr(4, 2)}-${dateDebut.substr(6, 2)}`),
            'endDate': dateFin !== "00000000" ? new Date(`${dateFin.substr(0, 4)}-${dateFin.substr(4, 2)}-${dateFin.substr(6, 2)}`) : "",
            'type': naturePrestation,
            'topPreAprouval': topEntentePrealable === "O",
            'regulatedPrice': parseFloat(`${tarifReference.substr(0, tarifReference.length -2 )}.${tarifReference.substr(tarifReference.length -2, 2)}`),
            'majorationDom': {
                '971' : parseFloat(`${majorationDom.substr(0, 1)}.${majorationDom.substr(1, 3)}`),
                '972' : parseFloat(`${majorationDom.substr(4, 1)}.${majorationDom.substr(5, 3)}`),
                '973' : parseFloat(`${majorationDom.substr(8, 1)}.${majorationDom.substr(9, 3)}`),
                '974' : parseFloat(`${majorationDom.substr(12, 1)}.${majorationDom.substr(13, 3)}`),
                '975' : parseFloat(`${majorationDom.substr(16, 1)}.${majorationDom.substr(17, 3)}`),
                '976' : parseFloat(`${majorationDom.substr(20, 1)}.${majorationDom.substr(21, 3)}`)
            },
            'maxQuantity': parseInt(quantiteMax),
            'tariff': parseFloat(`${montantMax.substr(0, montantMax.length -2)}.${montantMax.substr(montantMax.length -2, 2)}`),
            'maxSellingPrice': parseFloat(`${prixUnitaireReglementer.substr(0, prixUnitaireReglementer.length -2)}.${prixUnitaireReglementer.substr(prixUnitaireReglementer.length -2, 2)}`)
        })
    }

    /**
     * Check if the LPP is correct with Checksum
     * @param nombreEnregistrement : String - The Checksum
     * @param currLPP : Integer - The current count of different LPP Code
     * @returns {boolean} - True if the LPP is OK
     */
    checkLPP(nombreEnregistrement, currLPP) {
        if ( currLPP !== parseInt(nombreEnregistrement) ) return false
        return true
    }
}







