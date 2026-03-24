import { PureComponent } from 'react';
import { registerClientExtension } from 'camunda-modeler-plugin-helpers';

import FlowNormalizerModule from './bpmn-extension';
import { debug } from './log.mjs';

class FlowNormalizerPlugin extends PureComponent {

  constructor(props) {
    super(props);

    const { subscribe, displayNotification } = props;

    this._displayNotification = displayNotification;

    subscribe('bpmn.modeler.configure', ({ middlewares }) => {
      middlewares.push(config => ({
        ...config,
        additionalModules: [
          ...(config.additionalModules || []),
          FlowNormalizerModule
        ]
      }));
    });

    subscribe('bpmn.modeler.created', ({ modeler }) => {
      const editorActions = modeler.get('editorActions');
      const eventBus = modeler.get('eventBus');

      // Register keyboard shortcut Ctrl+Shift+E
      const keyboard = modeler.get('keyboard');
      keyboard.addListener((context) => {
        const event = context.keyEvent;

        if (event.ctrlKey && event.shiftKey && (event.key === 'E' || event.key === 'e')) {
          editorActions.trigger('normalizeHorizontalFlows');
          return true;
        }
      });

      // Listen for completion notification
      eventBus.on('flowNormalizer.done', (event) => {
        const { count, distance } = event;

        if (count === 0) {
          debug('No flows needed normalization');
          displayNotification({
            type: 'info',
            title: 'Flow Normalizer',
            content: 'All horizontal flows already have the correct distance.'
          });
        } else {
          debug(`Normalized ${count} flow(s) to ${distance}px`);
          displayNotification({
            type: 'success',
            title: 'Flow Normalizer',
            content: `Normalized ${count} flow(s) to ${distance}px distance.`
          });
        }
      });
    });
  }

  render() {
    return null;
  }
}

registerClientExtension(FlowNormalizerPlugin);
