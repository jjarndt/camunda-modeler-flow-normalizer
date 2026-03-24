import FlowNormalizerProvider from './FlowNormalizerProvider';
import FooterButton from '../FooterButton';

export default {
  __init__: ['flowNormalizerProvider', 'flowNormalizerFooterButton'],
  flowNormalizerProvider: ['type', FlowNormalizerProvider],
  flowNormalizerFooterButton: ['type', FooterButton]
};
