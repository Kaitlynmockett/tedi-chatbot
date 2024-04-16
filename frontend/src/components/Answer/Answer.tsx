import { FormEvent, useEffect, useMemo, useState, useContext } from "react";
import { useBoolean } from "@fluentui/react-hooks"
import { Checkbox, DefaultButton, Dialog, FontIcon, Stack, Text } from "@fluentui/react";
import DOMPurify from 'dompurify';
import { AppStateContext } from '../../state/AppProvider';

import styles from "./Answer.module.css";

import { AskResponse, Citation, Feedback, historyMessageFeedback } from "../../api";
import { parseAnswer } from "./AnswerParser";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import supersub from 'remark-supersub';
import {Prism as SyntaxHighlighter} from 'react-syntax-highlighter';
import { nord } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { XSSAllowTags } from "../../constants/xssAllowTags";

interface Props {
    answer: AskResponse;
    onCitationClicked: (citedDocument: Citation) => void;
}

export const Answer = ({
    answer,
    onCitationClicked
}: Props) => {
    const initializeAnswerFeedback = (answer: AskResponse) => {
        if (answer.message_id == undefined) return undefined;
        if (answer.feedback == undefined) return undefined;
        if (answer.feedback.split(",").length > 1) return Feedback.Negative;
        if (Object.values(Feedback).includes(answer.feedback)) return answer.feedback;
        return Feedback.Neutral;
    }

    const [isRefAccordionOpen, { toggle: toggleIsRefAccordionOpen }] = useBoolean(false);

    const parsedAnswer = useMemo(() => parseAnswer(answer), [answer]);
    const [chevronIsExpanded, setChevronIsExpanded] = useState(isRefAccordionOpen);
    const [feedbackState, setFeedbackState] = useState(initializeAnswerFeedback(answer));
    const appStateContext = useContext(AppStateContext) 
    const SANITIZE_ANSWER = appStateContext?.state.frontendSettings?.sanitize_answer 
    const [isReading, setIsReading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showSpeaker, setShowSpeaker] = useState(true);

    const checkStatus = (answer: AskResponse) => {
        if(answer.answer == "Generating answer..."){
            setIsGenerating(true);
            setShowSpeaker(false);
        }
        else{
            setIsGenerating(false);
            setShowSpeaker(true);
        }
    }

    useEffect(() => {
        checkStatus(answer);
    }, [answer])

    const handleTextToSpeech = (text: string) => {
        setIsReading(true);
        const audioContext = new AudioContext();
        fetch('synthesise_text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text })
        })
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
        .then(audioBuffer => {
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start();
            setIsReading(false);
        })
        .catch(error => {
            console.error('Error:', error);
            setIsReading(false);
        });

        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    };

    useEffect(() => {
        if (answer.message_id == undefined) return;
        
        let currentFeedbackState;
        if (appStateContext?.state.feedbackState && appStateContext?.state.feedbackState[answer.message_id]) {
            currentFeedbackState = appStateContext?.state.feedbackState[answer.message_id];
        } else {
            currentFeedbackState = initializeAnswerFeedback(answer);
        }
        setFeedbackState(currentFeedbackState)
    }, [appStateContext?.state.feedbackState, feedbackState, answer.message_id]);


    const components = {
        code({node, ...props}: {node: any, [key: string]: any}) {
            let language;
            if (props.className) {
                const match = props.className.match(/language-(\w+)/);
                language = match ? match[1] : undefined;
            }
            const codeString = node.children[0].value ?? '';
            return (
                <SyntaxHighlighter style={nord} language={language} PreTag="div" {...props}>
                    {codeString}
                </SyntaxHighlighter>
            );
        },
    };
    return (
        <>
            <Stack className={styles.answerContainer} tabIndex={0}>
                
                <Stack.Item>
                    <Stack horizontal grow>
                        <Stack.Item grow>
                            <ReactMarkdown
                                linkTarget="_blank"
                                remarkPlugins={[remarkGfm, supersub]}
                                children={SANITIZE_ANSWER ? DOMPurify.sanitize(parsedAnswer.markdownFormatText, {ALLOWED_TAGS: XSSAllowTags}) : parsedAnswer.markdownFormatText}
                                className={styles.answerText}
                                components={components}
                            />
                        </Stack.Item>
                        <div><button className={showSpeaker ? styles.showSpeaker : styles.hideSpeaker} onClick={() => handleTextToSpeech(JSON.stringify(parsedAnswer))}>{isReading ? <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="#CCCCCC"><path d="M160-80q-33 0-56.5-23.5T80-160v-640q0-33 23.5-56.5T160-880h326l-80 80H160v640h440v-80h80v80q0 33-23.5 56.5T600-80H160Zm80-160v-80h280v80H240Zm0-120v-80h200v80H240Zm360 0L440-520H320v-200h120l160-160v520Zm80-122v-276q36 21 58 57t22 81q0 45-22 81t-58 57Zm0 172v-84q70-25 115-86.5T840-620q0-78-45-139.5T680-846v-84q104 27 172 112.5T920-620q0 112-68 197.5T680-310Z"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M160-80q-33 0-56.5-23.5T80-160v-640q0-33 23.5-56.5T160-880h326l-80 80H160v640h440v-80h80v80q0 33-23.5 56.5T600-80H160Zm80-160v-80h280v80H240Zm0-120v-80h200v80H240Zm360 0L440-520H320v-200h120l160-160v520Zm80-122v-276q36 21 58 57t22 81q0 45-22 81t-58 57Zm0 172v-84q70-25 115-86.5T840-620q0-78-45-139.5T680-846v-84q104 27 172 112.5T920-620q0 112-68 197.5T680-310Z"/></svg>}</button></div>
                    </Stack>
                </Stack.Item>
                <Stack horizontal className={styles.answerFooter}>
                    <Stack.Item className={styles.answerDisclaimerContainer}>
                        <span className={styles.answerDisclaimer}>AI-generated content may be incorrect</span>
                    </Stack.Item>
                </Stack>
            </Stack>
        </>
    );
};
