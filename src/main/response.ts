// eslint-disable-next-line import/no-default-export
export default (() => {
    return typeof Response === 'undefined' ? require('node-fetch').Response : Response
})();
