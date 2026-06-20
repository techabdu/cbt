<?php

namespace App\Http\Requests\Lecturer;

use App\Enums\QuestionType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreQuestionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'question_text' => ['required', 'string', 'max:5000'],
            'question_type' => ['required', Rule::enum(QuestionType::class)],
            'marks'         => ['required', 'integer', 'min:1', 'max:100'],

            // MCQ
            'options'              => ['required_if:question_type,mcq', 'array', 'min:2', 'max:6'],
            'options.*.option_text' => ['required_with:options', 'string', 'max:1000'],
            'options.*.is_correct' => ['boolean'],

            // True / False
            'correct_answer' => ['required_if:question_type,true_false', 'in:true,false,1,0'],

            // Fill in the blank
            'answers'   => ['required_if:question_type,fill_blank', 'array', 'min:1', 'max:10'],
            'answers.*' => ['required_with:answers', 'string', 'max:255'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->input('question_type') !== QuestionType::Mcq->value) {
                    return;
                }

                $options = $this->input('options', []);
                $correct = collect($options)->filter(fn ($o) => filter_var($o['is_correct'] ?? false, FILTER_VALIDATE_BOOLEAN));

                if ($correct->count() !== 1) {
                    $validator->errors()->add('options',
                        'A multiple-choice question must have exactly one correct option.');
                }
            },
        ];
    }
}
