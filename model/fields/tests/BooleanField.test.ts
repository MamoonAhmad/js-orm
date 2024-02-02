import { BooleanField } from "../BooleanField"



describe('BooleanField', () => {


    describe('parseValue', () => {

        it('Should parse the value to boolean', () => {
            expect(new BooleanField({}).parseValue(1)).toBe(true)
            expect(new BooleanField({}).parseValue(undefined)).toBe(null)
            expect(new BooleanField({}).parseValue(null)).toBe(null)
            expect(new BooleanField({}).parseValue(false)).toBe(false)
            expect(new BooleanField({}).parseValue('11')).toBe(true)
        })

    })

})