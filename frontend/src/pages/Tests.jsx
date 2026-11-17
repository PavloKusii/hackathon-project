import { useState } from 'react';

const CATEGORIES = [
    { id: 'honesty', label: 'Порушення чесності' },
    { id: 'efficiency', label: 'Порушення ефективності' },
    { id: 'trust', label: 'Порушення довіри' }
];

function Tests() {
    const [tests, setTests] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);

    const [testTitle, setTestTitle] = useState('');
    const [questions, setQuestions] = useState([]);

    const [questionText, setQuestionText] = useState('');

    // Структура відповідей тепер містить isCorrect та масив обраних порушень
    const [answers, setAnswers] = useState([
        { text: '', isCorrect: true, violations: [] },
        { text: '', isCorrect: false, violations: [{ category: 'honesty', points: 1, explanation: '' }] }
    ]);

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentStep(1);
        setTestTitle('');
        setQuestions([]);
        resetQuestionForm();
    };

    const resetQuestionForm = () => {
        setQuestionText('');
        setAnswers([
            { text: '', isCorrect: true, violations: [] },
            { text: '', isCorrect: false, violations: [{ category: 'honesty', points: 1, explanation: '' }] }
        ]);
    };

    const handleNextStep = (e) => {
        e.preventDefault();
        if (!testTitle.trim()) return;
        setCurrentStep(2);
    };

    const handleAnswerTextChange = (index, value) => {
        const updated = [...answers];
        updated[index].text = value;
        setAnswers(updated);
    };

    // Перемикання: Правильна / Неправильна відповідь
    const handleToggleCorrect = (index, isCorrect) => {
        const updated = [...answers];
        updated[index].isCorrect = isCorrect;
        if (isCorrect) {
            updated[index].violations = [];
        } else if (updated[index].violations.length === 0) {
            // Додаємо початкове порушення за замовчуванням
            updated[index].violations = [{ category: 'honesty', points: 1, explanation: '' }];
        }
        setAnswers(updated);
    };

    // Перемикання конкретної категорії порушення (чекбокс)
    const handleToggleCategory = (ansIndex, categoryId) => {
        const updated = [...answers];
        const currentViolations = updated[ansIndex].violations;
        const exists = currentViolations.find((v) => v.category === categoryId);

        if (exists) {
            updated[ansIndex].violations = currentViolations.filter((v) => v.category !== categoryId);
        } else {
            updated[ansIndex].violations.push({ category: categoryId, points: 1, explanation: '' });
        }
        setAnswers(updated);
    };

    // Зміна балів або пояснення для конкретної категорії
    const handleViolationChange = (ansIndex, categoryId, field, value) => {
        const updated = [...answers];
        const violation = updated[ansIndex].violations.find((v) => v.category === categoryId);
        if (violation) {
            violation[field] = value;
            setAnswers(updated);
        }
    };

    const handleAddAnswerOption = () => {
        setAnswers([
            ...answers,
            { text: '', isCorrect: false, violations: [{ category: 'honesty', points: 1, explanation: '' }] }
        ]);
    };

    const handleRemoveAnswerOption = (indexToRemove) => {
        if (answers.length <= 2) {
            alert('Питання повинно мати щонайменше 2 варіанти відповідей!');
            return;
        }
        setAnswers(answers.filter((_, index) => index !== indexToRemove));
    };

    const handleAddQuestion = (e) => {
        e.preventDefault();
        if (!questionText.trim()) return;

        const newQuestion = {
            id: Date.now(),
            text: questionText,
            answers: [...answers]
        };

        setQuestions([...questions, newQuestion]);
        resetQuestionForm();
    };

    const handleSaveTest = () => {
        if (questions.length === 0) {
            alert('Додайте хоча б одне питання перед збереженням тесту!');
            return;
        }

        const newTest = {
            id: Date.now(),
            title: testTitle,
            questions: questions
        };

        setTests([...tests, newTest]);
        handleCloseModal();
    };

    const handleDeleteTest = (id) => {
        setTests(tests.filter((test) => test.id !== id));
    };

    return (
        <div style={{ padding: '20px', maxWidth: '950px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1>Управління тестами</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    style={{
                        padding: '10px 20px',
                        background: '#22c55e',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px'
                    }}
                >
                    + Створити тест
                </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                <tr style={{ borderBottom: '2px solid #cbd5e1', background: '#f1f5f9' }}>
                    <th style={{ padding: '12px' }}>ID</th>
                    <th style={{ padding: '12px' }}>Назва тесту</th>
                    <th style={{ padding: '12px' }}>К-сть питань</th>
                    <th style={{ padding: '12px' }}>Дії</th>
                </tr>
                </thead>
                <tbody>
                {tests.length > 0 ? (
                    tests.map((test) => (
                        <tr key={test.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '12px' }}>{test.id}</td>
                            <td style={{ padding: '12px', fontWeight: 'bold' }}>{test.title}</td>
                            <td style={{ padding: '12px' }}>{test.questions?.length || 0}</td>
                            <td style={{ padding: '12px' }}>
                                <button
                                    onClick={() => handleDeleteTest(test.id)}
                                    style={{
                                        padding: '6px 12px',
                                        background: '#ef4444',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Видалити
                                </button>
                            </td>
                        </tr>
                    ))
                ) : (
                    <tr>
                        <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                            Тестів поки немає. Натисніть "+ Створити тест", щоб додати перший.
                        </td>
                    </tr>
                )}
                </tbody>
            </table>

            {isModalOpen && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 1000
                    }}
                >
                    <div
                        style={{
                            background: '#fff',
                            padding: '25px',
                            borderRadius: '8px',
                            width: currentStep === 1 ? '420px' : '850px',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h2 style={{ margin: 0, fontSize: '20px' }}>
                                {currentStep === 1 ? 'Створення тесту (Крок 1)' : `Тест: "${testTitle}" (Крок 2: Питання)`}
                            </h2>
                            <button
                                onClick={handleCloseModal}
                                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
                            >
                                ✕
                            </button>
                        </div>

                        {currentStep === 1 && (
                            <form onSubmit={handleNextStep}>
                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                                        Назва тесту:
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Введіть назву тесту..."
                                        value={testTitle}
                                        onChange={(e) => setTestTitle(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            borderRadius: '6px',
                                            border: '1px solid #cbd5e1',
                                            boxSizing: 'border-box',
                                            fontSize: '14px'
                                        }}
                                        autoFocus
                                        required
                                    />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                    <button
                                        type="button"
                                        onClick={handleCloseModal}
                                        style={{ padding: '9px 18px', background: '#94a3b8', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                    >
                                        Скасувати
                                    </button>
                                    <button
                                        type="submit"
                                        style={{ padding: '9px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                    >
                                        Далі ➔
                                    </button>
                                </div>
                            </form>
                        )}

                        {currentStep === 2 && (
                            <div>
                                {questions.length > 0 && (
                                    <div style={{ marginBottom: '20px', padding: '10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                        <h4 style={{ margin: '0 0 10px 0' }}>Додані питання ({questions.length}):</h4>
                                        <ol style={{ paddingLeft: '20px', margin: 0 }}>
                                            {questions.map((q) => (
                                                <li key={q.id} style={{ marginBottom: '4px', fontSize: '14px' }}>
                                                    {q.text} ({q.answers.length} варіантів)
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                )}

                                <form onSubmit={handleAddQuestion} style={{ borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
                                    <div style={{ marginBottom: '15px' }}>
                                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px' }}>
                                            Текст питання:
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Введіть питання..."
                                            value={questionText}
                                            onChange={(e) => setQuestionText(e.target.value)}
                                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                                            required
                                        />
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '15px 0 10px 0' }}>
                                        <h4 style={{ margin: 0 }}>Варіанти відповідей ({answers.length}):</h4>
                                        <button
                                            type="button"
                                            onClick={handleAddAnswerOption}
                                            style={{
                                                padding: '5px 10px',
                                                background: '#3b82f6',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '13px'
                                            }}
                                        >
                                            + Додати варіант
                                        </button>
                                    </div>

                                    {answers.map((ans, ansIndex) => (
                                        <div
                                            key={ansIndex}
                                            style={{
                                                background: '#1e293b',
                                                color: '#fff',
                                                padding: '14px',
                                                borderRadius: '6px',
                                                marginBottom: '14px'
                                            }}
                                        >
                                            {/* Верхній рядок варіанта */}
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                                                <span style={{ fontWeight: 'bold', width: '20px' }}>{ansIndex + 1}.</span>

                                                <input
                                                    type="text"
                                                    placeholder={`Варіант відповіді ${ansIndex + 1}`}
                                                    value={ans.text}
                                                    onChange={(e) => handleAnswerTextChange(ansIndex, e.target.value)}
                                                    style={{
                                                        flex: 1,
                                                        padding: '8px',
                                                        borderRadius: '4px',
                                                        border: '1px solid #475569',
                                                        background: '#334155',
                                                        color: '#ffffff'
                                                    }}
                                                    required
                                                />

                                                {/* Перемикач: Правильна чи Неправильна */}
                                                <select
                                                    value={ans.isCorrect ? 'correct' : 'incorrect'}
                                                    onChange={(e) => handleToggleCorrect(ansIndex, e.target.value === 'correct')}
                                                    style={{
                                                        padding: '8px',
                                                        borderRadius: '4px',
                                                        border: '1px solid #475569',
                                                        background: ans.isCorrect ? '#15803d' : '#b91c1c',
                                                        color: '#ffffff',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    <option value="correct">Правильна відповідь</option>
                                                    <option value="incorrect">Неправильна (з порушеннями)</option>
                                                </select>

                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveAnswerOption(ansIndex)}
                                                    style={{
                                                        padding: '6px 10px',
                                                        background: '#ef4444',
                                                        color: '#fff',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer'
                                                    }}
                                                    title="Видалити варіант"
                                                >
                                                    ✕
                                                </button>
                                            </div>

                                            {/* Блок вибору кількох порушень */}
                                            {!ans.isCorrect && (
                                                <div style={{ background: '#0f172a', padding: '12px', borderRadius: '6px', marginTop: '8px' }}>
                          <span style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
                            Оберіть порушення для цієї відповіді (можна декілька):
                          </span>

                                                    {CATEGORIES.map((cat) => {
                                                        const violation = ans.violations.find((v) => v.category === cat.id);
                                                        const isSelected = Boolean(violation);

                                                        return (
                                                            <div key={cat.id} style={{ marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #1e293b' }}>
                                                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={() => handleToggleCategory(ansIndex, cat.id)}
                                                                    />
                                                                    {cat.label}
                                                                </label>

                                                                {isSelected && (
                                                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', paddingLeft: '24px' }}>
                                                                        <input
                                                                            type="number"
                                                                            placeholder="Бали"
                                                                            value={violation.points}
                                                                            onChange={(e) => handleViolationChange(ansIndex, cat.id, 'points', Number(e.target.value) || 0)}
                                                                            style={{
                                                                                width: '70px',
                                                                                padding: '6px',
                                                                                borderRadius: '4px',
                                                                                border: '1px solid #475569',
                                                                                background: '#334155',
                                                                                color: '#ffffff'
                                                                            }}
                                                                            title="Скільки балів зняти з цієї категорії"
                                                                            min="0"
                                                                            required
                                                                        />
                                                                        <input
                                                                            type="text"
                                                                            placeholder={`Пояснення для "${cat.label}"...`}
                                                                            value={violation.explanation}
                                                                            onChange={(e) => handleViolationChange(ansIndex, cat.id, 'explanation', e.target.value)}
                                                                            style={{
                                                                                flex: 1,
                                                                                padding: '6px 10px',
                                                                                borderRadius: '4px',
                                                                                border: '1px solid #475569',
                                                                                background: '#334155',
                                                                                color: '#ffffff',
                                                                                fontSize: '13px'
                                                                            }}
                                                                            required
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    <button
                                        type="submit"
                                        style={{
                                            marginTop: '10px',
                                            padding: '10px 16px',
                                            background: '#0284c7',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            width: '100%',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        + Додати це питання до тесту
                                    </button>
                                </form>

                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '25px', borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setCurrentStep(1)}
                                        style={{ padding: '9px 18px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                    >
                                        ◄ Назад
                                    </button>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={handleCloseModal}
                                            style={{ padding: '9px 18px', background: '#94a3b8', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                        >
                                            Скасувати
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveTest}
                                            style={{ padding: '9px 18px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            Зберегти тест
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Tests;